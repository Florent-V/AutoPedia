<?php

declare(strict_types=1);

namespace App\Progression\Domain;

/** Palier d'un succès et crédits versés automatiquement à son déblocage. */
enum BadgeTier: string
{
    case BRONZE = 'bronze';
    case SILVER = 'silver';
    case GOLD = 'gold';
    case PLATINUM = 'platinum';

    public function reward(): int
    {
        return match ($this) {
            self::BRONZE => 50,
            self::SILVER => 150,
            self::GOLD => 400,
            self::PLATINUM => 1000,
        };
    }
}
