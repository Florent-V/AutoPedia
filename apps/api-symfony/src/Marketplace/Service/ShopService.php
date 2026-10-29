<?php

declare(strict_types=1);

namespace App\Marketplace\Service;

use App\Catalog\Repository\CarRepository;
use App\Collection\Service\CardsService;
use App\Marketplace\Domain\ShopRotation;
use App\Marketplace\Entity\ShopPurchase;
use App\Marketplace\Event\ShopCardPurchased;
use App\Player\Repository\PlayerRepository;
use App\Shared\Domain\Exception\NotFound;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Domain\GameCalendar;
use App\Shared\Transaction\UnitOfWork;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class ShopService
{
    private readonly string $secret;

    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly CarRepository $cars,
        private readonly WalletService $wallet,
        private readonly CardsService $cards,
        private readonly EntityManagerInterface $em,
        private readonly GameCalendar $calendar,
        private readonly ClockInterface $clock,
        #[Autowire(env: 'SHOP_SECRET')] string $shopSecret,
        #[Autowire(env: 'APP_SECRET')] string $appSecret,
    ) {
        // Graine secrète : empêche de calculer à l'avance le programme des jours suivants.
        $this->secret = '' !== $shopSecret ? $shopSecret : hash('sha256', 'shop:'.$appSecret);
    }

    /** @return array{date: string, hour: int, offers: list<array<string, mixed>>} offres de l'heure, recalculées par le serveur */
    public function currentOffers(?\DateTimeImmutable $now = null): array
    {
        $now ??= $this->now();
        $date = $this->calendar->day($now);
        $hour = $this->calendar->hour($now);

        return ['date' => $date, 'hour' => $hour, 'offers' => ShopRotation::offersAt($this->cars->activeIdsByRarity(), $this->secret, $date, $hour)];
    }

    /**
     * Achat d'une offre de l'heure : le client n'envoie que la clé ; carte et prix viennent du serveur.
     *
     * @return array{carId: int, quantity: int, isNew: bool, balance: int}
     */
    public function buy(string $userId, string $offerKey): array
    {
        return $this->uow->run(function () use ($userId, $offerKey) {
            $player = $this->players->lock($userId)[$userId];
            $offer = null;
            foreach ($this->currentOffers()['offers'] as $o) {
                if ($o['offerKey'] === $offerKey) {
                    $offer = $o;
                }
            }
            if (!$offer) {
                throw new NotFound('Cette offre n’est plus disponible (la boutique a tourné)');
            }
            if ($this->em->getRepository(ShopPurchase::class)->count(['userId' => $userId, 'offerKey' => $offerKey]) > 0) {
                throw new RuleViolation('Vous avez déjà acheté cette offre');
            }
            $purchase = new ShopPurchase($userId, $offerKey, $offer['carId'], $offer['price'], $this->now());
            $this->em->persist($purchase);
            $this->wallet->debit($userId, $offer['price'], LedgerReason::SHOP, $purchase->id());
            $card = $this->cards->grant($userId, $offer['carId']);
            ++$player->activity()->shopPurchases;
            $this->uow->publish(new ShopCardPurchased($userId, $offer['carId'], $offer['price']));

            return $card + ['balance' => $player->wallet()->balance()];
        });
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
