<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Offre de la bourse : soit une carte demandée en échange, soit un prix (le domaine refuse les deux ou aucun). */
final class CreateTradeInput
{
    #[Assert\Positive]
    public int $offeredCarId;

    #[Assert\Positive]
    public ?int $wantedCarId = null;

    #[Assert\Range(min: 1, max: 1_000_000)]
    public ?int $price = null;
}
