<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class CreateAuctionInput
{
    #[Assert\Positive]
    public int $carId;

    #[Assert\Range(min: 1, max: 1_000_000)]
    public int $startPrice;

    /** Durée autorisée : vérifiée par l'entité Auction (liste AUCTION_DURATIONS). */
    public int $durationHours;
}
