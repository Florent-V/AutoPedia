<?php

declare(strict_types=1);

namespace App\Catalog\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class ImportInput
{
    #[Assert\Choice(['wikidata', 'seed', 'media'])]
    public ?string $source = null;

    #[Assert\Range(min: 1, max: 20_000)]
    public ?int $limit = null;
}
