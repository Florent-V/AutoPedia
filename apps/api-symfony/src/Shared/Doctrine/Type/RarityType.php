<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use App\Catalog\Domain\Rarity;

/** Type PostgreSQL « Rarity » ↔ enum PHP Rarity. */
final class RarityType extends PostgresEnumType
{
    protected function enumClass(): string
    {
        return Rarity::class;
    }

    protected function sqlType(): string
    {
        return 'Rarity';
    }
}
