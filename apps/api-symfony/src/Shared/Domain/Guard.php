<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use App\Shared\Domain\Exception\InvalidRequest;

/**
 * Contrôles de bornes répétés dans le domaine : même si la validation HTTP laisse passer une valeur,
 * le domaine refuse tout entier négatif, nul ou démesuré (défense en profondeur).
 */
final class Guard
{
    public static function positiveInt(mixed $value, string $what, int $max = 1_000_000_000): int
    {
        if (!\is_int($value) || $value < 1 || $value > $max) {
            throw new InvalidRequest("$what invalide");
        }

        return $value;
    }

    public static function nonNegativeInt(mixed $value, string $what, int $max = 1_000_000_000): int
    {
        if (!\is_int($value) || $value < 0 || $value > $max) {
            throw new InvalidRequest("$what invalide");
        }

        return $value;
    }
}
