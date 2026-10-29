<?php

declare(strict_types=1);

namespace App\Collection\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Paramètres de /collection (tous optionnels, valeurs bornées). */
final class CollectionFilter
{
    #[Assert\Length(max: 100)]
    public ?string $search = null;

    #[Assert\Choice(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'])]
    public ?string $rarity = null;

    #[Assert\Length(max: 100)]
    public ?string $manufacturer = null;

    #[Assert\Choice(['racing', 'road'])]
    public ?string $category = null;

    #[Assert\Choice(['all', 'owned', 'missing'])]
    public string $owned = 'all';

    #[Assert\Choice(['rarity', 'name', 'year', 'recent'])]
    public string $sort = 'rarity';

    #[Assert\Range(min: 1, max: 10_000)]
    public int $page = 1;

    #[Assert\Range(min: 1, max: 100)]
    public int $pageSize = 30;
}
