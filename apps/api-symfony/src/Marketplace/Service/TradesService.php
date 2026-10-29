<?php

declare(strict_types=1);

namespace App\Marketplace\Service;

use App\Catalog\Repository\CarRepository;
use App\Collection\Service\CardsService;
use App\Marketplace\Entity\TradeOffer;
use App\Marketplace\Event\TradeCompleted;
use App\Marketplace\Repository\TradeOfferRepository;
use App\Player\Repository\PlayerRepository;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\Exception\NotFound;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Transaction\UnitOfWork;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Bourse d'échanges. Verrous : l'offre d'abord, puis les joueurs (triés) — même ordre partout. */
final class TradesService
{
    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly TradeOfferRepository $trades,
        private readonly CarRepository $cars,
        private readonly WalletService $wallet,
        private readonly CardsService $cards,
        private readonly MarketAccess $access,
        private readonly EntityManagerInterface $em,
        private readonly GameSettings $settings,
        private readonly ClockInterface $clock,
    ) {
    }

    /** @return array{id: string} */
    public function create(string $sellerId, int $offeredCarId, ?int $wantedCarId, ?int $price): array
    {
        return $this->uow->run(function () use ($sellerId, $offeredCarId, $wantedCarId, $price) {
            $now = $this->now();
            $offer = new TradeOffer($sellerId, $offeredCarId, $wantedCarId, $price, $now, $this->settings->tradeDays);
            $this->players->lock($sellerId);
            $this->access->assert($sellerId, $now);
            $offered = $this->cars->find($offeredCarId) ?? throw new NotFound('Carte introuvable');
            $open = $this->trades->countOpenBySeller($sellerId);
            if ($open >= $this->settings->maxOpenTrades) {
                throw new RuleViolation("Vous avez déjà $open offres ouvertes (maximum {$this->settings->maxOpenTrades})");
            }
            if (null !== $wantedCarId) {
                $wanted = $this->cars->activeExists($wantedCarId) ? $this->cars->find($wantedCarId) : null;
                if (!$wanted) {
                    throw new NotFound('Carte demandée introuvable');
                }
                $this->access->policy->assertFairSwap($offered->effectiveRarity(), $wanted->effectiveRarity());
            } else {
                $this->access->policy->assertPriceFloor($offered->effectiveRarity(), $price);
            }
            // Séquestre : la carte quitte la collection tant que l'offre est ouverte.
            $this->cards->take($sellerId, $offeredCarId);
            $this->em->persist($offer);

            return ['id' => $offer->id()];
        });
    }

    /** @return array<string, mixed> */
    public function accept(string $buyerId, string $id): array
    {
        return $this->uow->run(function () use ($buyerId, $id) {
            $offer = $this->trades->getForUpdate($id);
            $now = $this->now();
            $offer->accept($buyerId, $now);
            $players = $this->players->lock($buyerId, $offer->sellerId());
            $this->access->assert($buyerId, $now);
            if (null !== $offer->wantedCarId()) {
                $this->cards->take($buyerId, $offer->wantedCarId());
                $this->cards->grant($offer->sellerId(), $offer->wantedCarId());
            } else {
                $this->wallet->debit($buyerId, $offer->price(), LedgerReason::TRADE_PURCHASE, $offer->id());
                $this->wallet->credit($offer->sellerId(), $offer->price(), LedgerReason::TRADE_SALE, $offer->id());
            }
            $card = $this->cards->grant($buyerId, $offer->offeredCarId());
            ++$players[$buyerId]->activity()->tradesCompleted;
            ++$players[$offer->sellerId()]->activity()->tradesCompleted;
            $this->uow->publish(new TradeCompleted($offer->id(), $offer->sellerId(), $buyerId, $offer->offeredCarId()));

            return $card + ['tradeId' => $offer->id(), 'balance' => $players[$buyerId]->wallet()->balance()];
        });
    }

    public function cancel(string $userId, string $id): array
    {
        return $this->uow->run(function () use ($userId, $id) {
            $offer = $this->trades->getForUpdate($id);
            $offer->cancel($userId, $this->now());
            $this->release($offer);

            return ['ok' => true];
        });
    }

    /** Clôt les offres expirées et rend les cartes sous séquestre (tâche planifiée). */
    public function expireDue(): int
    {
        $done = 0;
        foreach ($this->trades->expiredIds($this->now(), 200) as $id) {
            try {
                $this->uow->run(function () use ($id) {
                    $offer = $this->trades->getForUpdate($id);
                    $offer->expire($this->now());
                    $this->release($offer);
                });
                ++$done;
            } catch (\Throwable) {
                // Déjà acceptée ou annulée entre-temps.
            }
        }

        return $done;
    }

    private function release(TradeOffer $offer): void
    {
        $this->players->lock($offer->sellerId());
        $this->cards->grant($offer->sellerId(), $offer->offeredCarId());
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
