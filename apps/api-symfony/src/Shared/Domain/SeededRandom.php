<?php

declare(strict_types=1);

namespace App\Shared\Domain;

/**
 * Aléatoire déterministe (mulberry32, graine dérivée de sha256) : même graine, même suite.
 * Sert au programme de la boutique, recalculable à chaque requête sans le stocker.
 */
final class SeededRandom implements Random
{
    private int $state;

    public function __construct(string $seed)
    {
        $this->state = hexdec(substr(hash('sha256', $seed), 0, 8));
    }

    public function next(): float
    {
        $this->state = ($this->state + 0x6D2B79F5) & 0xFFFFFFFF;
        $t = $this->state;
        $t = self::imul($t ^ ($t >> 15), $t | 1);
        $t ^= ($t + self::imul($t ^ ($t >> 7), $t | 61)) & 0xFFFFFFFF;

        return (($t ^ ($t >> 14)) & 0xFFFFFFFF) / 4294967296;
    }

    /** Multiplication 32 bits (équivalent de Math.imul). */
    private static function imul(int $a, int $b): int
    {
        $a &= 0xFFFFFFFF;
        $b &= 0xFFFFFFFF;
        $low = (($a & 0xFFFF) * $b) & 0xFFFFFFFF;
        $high = ((($a >> 16) * $b) & 0xFFFF) << 16;

        return ($low + $high) & 0xFFFFFFFF;
    }
}
