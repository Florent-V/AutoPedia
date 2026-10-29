<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Filtres communs des listes du marché (paramètres d'URL). */
abstract class MarketListFilter
{
    #[Assert\Choice(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'])]
    public ?string $rarity = null;

    #[Assert\Length(max: 100)]
    public ?string $search = null;

    #[Assert\Range(min: 1, max: 10_000)]
    public int $page = 1;
}
