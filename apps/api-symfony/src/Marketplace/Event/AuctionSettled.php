<?php

declare(strict_types=1);

namespace App\Marketplace\Event;

final readonly class AuctionSettled
{
    public function __construct(
        public string $auctionId,
        public bool $sold,
        public string $sellerId,
        public ?string $buyerId,
        public int $carId,
        public ?int $price,
    ) {
    }
}
