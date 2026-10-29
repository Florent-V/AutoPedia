<?php

declare(strict_types=1);

namespace App\Marketplace\Event;

final readonly class TradeCompleted
{
    public function __construct(public string $tradeId, public string $sellerId, public string $buyerId, public int $offeredCarId)
    {
    }
}
