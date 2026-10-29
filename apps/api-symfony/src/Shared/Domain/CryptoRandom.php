<?php

declare(strict_types=1);

namespace App\Shared\Domain;

/** Aléatoire cryptographique : les tirages ne sont pas prévisibles depuis l'extérieur. */
final class CryptoRandom implements Random
{
    private const SCALE = 2 ** 48;

    public function next(): float
    {
        return random_int(0, self::SCALE - 1) / self::SCALE;
    }
}
