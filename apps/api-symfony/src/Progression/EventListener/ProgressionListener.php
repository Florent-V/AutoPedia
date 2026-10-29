<?php

declare(strict_types=1);

namespace App\Progression\EventListener;

use App\Collection\Event\BoosterOpened;
use App\Games\Event\GameRoundPlayed;
use App\Marketplace\Event\AuctionSettled;
use App\Marketplace\Event\ShopCardPurchased;
use App\Marketplace\Event\TradeCompleted;
use App\Progression\Service\AchievementService;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/** Les actions des autres contextes font progresser le joueur : succès évalués dans la même transaction. */
final class ProgressionListener
{
    public function __construct(private readonly AchievementService $achievements)
    {
    }

    #[AsEventListener]
    public function onBoosterOpened(BoosterOpened $event): void
    {
        $this->achievements->evaluate($event->userId);
    }

    #[AsEventListener]
    public function onGameRoundPlayed(GameRoundPlayed $event): void
    {
        $this->achievements->evaluate($event->userId);
    }

    #[AsEventListener]
    public function onShopCardPurchased(ShopCardPurchased $event): void
    {
        $this->achievements->evaluate($event->userId);
    }

    #[AsEventListener]
    public function onTradeCompleted(TradeCompleted $event): void
    {
        $this->achievements->evaluate($event->buyerId);
        $this->achievements->evaluate($event->sellerId);
    }

    #[AsEventListener]
    public function onAuctionSettled(AuctionSettled $event): void
    {
        if ($event->sold && $event->buyerId) {
            $this->achievements->evaluate($event->buyerId);
            $this->achievements->evaluate($event->sellerId);
        }
    }
}
