<?php

declare(strict_types=1);

namespace App\Marketplace\Event;

final readonly class ShopCardPurchased
{
    public function __construct(public string $userId, public int $carId, public int $price)
    {
    }
}
