<?php

declare(strict_types=1);

namespace App\Marketplace\Service;

use App\Catalog\Repository\CarRepository;
use App\Collection\Service\CardsService;
use App\Marketplace\Entity\Auction;
use App\Marketplace\Entity\Bid;
use App\Marketplace\Event\AuctionOutbid;
use App\Marketplace\Event\AuctionSettled;
use App\Marketplace\Repository\AuctionRepository;
use App\Player\Repository\PlayerRepository;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\Exception\NotFound;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Domain\Iso;
use App\Shared\Transaction\UnitOfWork;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;

/** Enchères. Verrous : l'enchère d'abord, puis les joueurs (triés) — même ordre partout. */
final class AuctionsService
{
    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly AuctionRepository $auctions,
        private readonly CarRepository $cars,
        private readonly WalletService $wallet,
        private readonly CardsService $cards,
        private readonly MarketAccess $access,
        private readonly EntityManagerInterface $em,
        private readonly GameSettings $settings,
        private readonly ClockInterface $clock,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** @return array{id: string} */
    public function create(string $sellerId, int $carId, int $startPrice, int $durationHours): array
    {
        return $this->uow->run(function () use ($sellerId, $carId, $startPrice, $durationHours) {
            $now = $this->now();
            $auction = new Auction($sellerId, $carId, $startPrice, $durationHours, $this->settings->auctionDurations, $now);
            $this->players->lock($sellerId);
            $this->access->assert($sellerId, $now);
            $car = $this->cars->find($carId) ?? throw new NotFound('Carte introuvable');
            $this->access->policy->assertPriceFloor($car->effectiveRarity(), $startPrice);
            $open = $this->auctions->countOpenBySeller($sellerId);
            if ($open >= $this->settings->maxOpenAuctions) {
                throw new RuleViolation("Vous avez déjà $open enchères en cours (maximum {$this->settings->maxOpenAuctions})");
            }
            // Séquestre : la carte quitte la collection jusqu'à la fin de l'enchère.
            $this->cards->take($sellerId, $carId);
            $this->em->persist($auction);

            return ['id' => $auction->id()];
        });
    }

    /** Offre : les crédits de l'enchérisseur sont bloqués, le précédent meilleur enchérisseur est remboursé. */
    public function bid(string $userId, string $id, int $amount): array
    {
        return $this->uow->run(function () use ($userId, $id, $amount) {
            $auction = $this->auctions->getForUpdate($id);
            $now = $this->now();
            $previous = $auction->bid($userId, $amount, $now, $this->settings->auctionSnipeSeconds);
            $players = $this->players->lock($userId, ...($previous ? [$previous['userId']] : []));
            $this->access->assert($userId, $now);
            $this->wallet->debit($userId, $amount, LedgerReason::AUCTION_BID, $auction->id());
            if ($previous) {
                $this->wallet->credit($previous['userId'], $previous['amount'], LedgerReason::AUCTION_REFUND, $auction->id());
            }
            $this->em->persist(new Bid($auction->id(), $userId, $amount, $now));
            if ($previous) {
                $this->uow->publish(new AuctionOutbid($auction->id(), $previous['userId'], $auction->carId(), $amount));
            }

            return ['id' => $id, 'currentBid' => $auction->currentBid(), 'minBid' => $auction->minBid(), 'endsAt' => Iso::format($auction->endsAt()), 'balance' => $players[$userId]->wallet()->balance()];
        });
    }

    public function cancel(string $userId, string $id): array
    {
        return $this->uow->run(function () use ($userId, $id) {
            $auction = $this->auctions->getForUpdate($id);
            $auction->cancel($userId, $this->now());
            $this->players->lock($userId);
            $this->cards->grant($userId, $auction->carId());

            return ['ok' => true];
        });
    }

    /** Clôt les enchères échues (tâche planifiée) : carte à l'acheteur, prix moins la commission au vendeur. */
    public function settleDue(): void
    {
        foreach ($this->auctions->dueIds($this->now(), 200) as $id) {
            try {
                $this->uow->run(function () use ($id) {
                    $auction = $this->auctions->getForUpdate($id);
                    if (!$auction->isDue($this->now())) {
                        return;
                    }
                    $r = $auction->settle($this->now(), $this->settings->auctionFeePercent);
                    if (!$r['sold']) {
                        $this->players->lock($r['sellerId']);
                        $this->cards->grant($r['sellerId'], $r['carId']);
                    } else {
                        $players = $this->players->lock($r['sellerId'], $r['buyerId']);
                        $this->cards->grant($r['buyerId'], $r['carId']);
                        if ($r['sellerProceeds'] > 0) {
                            $this->wallet->credit($r['sellerId'], $r['sellerProceeds'], LedgerReason::AUCTION_SALE, $auction->id());
                        }
                        ++$players[$r['buyerId']]->activity()->auctionsWon;
                        ++$players[$r['sellerId']]->activity()->auctionsSold;
                    }
                    $this->uow->publish(new AuctionSettled($auction->id(), $r['sold'], $r['sellerId'], $r['buyerId'], $r['carId'], $r['price']));
                });
            } catch (\Throwable $e) {
                $this->logger->warning(\sprintf('Règlement de l\'enchère %s impossible : %s', $id, $e->getMessage()));
            }
        }
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
