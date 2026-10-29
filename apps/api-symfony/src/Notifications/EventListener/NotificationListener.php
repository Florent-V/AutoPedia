<?php

declare(strict_types=1);

namespace App\Notifications\EventListener;

use App\Catalog\Repository\CarRepository;
use App\Marketplace\Event\AuctionOutbid;
use App\Marketplace\Event\AuctionSettled;
use App\Marketplace\Event\TradeCompleted;
use App\Notifications\Service\PushService;
use App\Shared\Transaction\UnitOfWork;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/** Notifications envoyées après validation des transactions (jamais pour une action annulée). */
final class NotificationListener
{
    public function __construct(private readonly PushService $push, private readonly CarRepository $cars)
    {
    }

    #[AsEventListener(event: UnitOfWork::AFTER_COMMIT_PREFIX.TradeCompleted::class)]
    public function onTradeCompleted(TradeCompleted $e): void
    {
        $this->push->sendToUser($e->sellerId, [
            'title' => 'Échange conclu 🤝',
            'body' => \sprintf('Votre « %s » a trouvé preneur à la bourse.', $this->carName($e->offeredCarId)),
            'url' => '/market?tab=trades',
            'tag' => 'trade-'.$e->tradeId,
        ]);
    }

    #[AsEventListener(event: UnitOfWork::AFTER_COMMIT_PREFIX.AuctionOutbid::class)]
    public function onOutbid(AuctionOutbid $e): void
    {
        $this->push->sendToUser($e->outbidUserId, [
            'title' => 'Vous avez été surenchéri ⚠️',
            'body' => \sprintf('« %s » : nouvelle offre à %d crédits. Vos crédits vous ont été rendus.', $this->carName($e->carId), $e->newBid),
            'url' => '/market?tab=auctions',
            'tag' => 'auction-'.$e->auctionId,
        ]);
    }

    #[AsEventListener(event: UnitOfWork::AFTER_COMMIT_PREFIX.AuctionSettled::class)]
    public function onSettled(AuctionSettled $e): void
    {
        if (!$e->sold || null === $e->buyerId) {
            return;
        }
        $name = $this->carName($e->carId);
        $this->push->sendToUser($e->buyerId, [
            'title' => 'Enchère remportée 🔨',
            'body' => \sprintf('« %s » rejoint votre garage pour %d crédits.', $name, $e->price),
            'url' => '/collection',
            'tag' => 'auction-'.$e->auctionId,
        ]);
        $this->push->sendToUser($e->sellerId, [
            'title' => 'Vente aux enchères conclue 💰',
            'body' => \sprintf('« %s » est parti pour %d crédits.', $name, $e->price),
            'url' => '/market?tab=auctions',
            'tag' => 'auction-'.$e->auctionId,
        ]);
    }

    private function carName(int $carId): string
    {
        return $this->cars->find($carId)?->name ?? 'Votre carte';
    }
}
