<?php

declare(strict_types=1);

namespace App\Tests\Support;

use App\Shared\Domain\Random;

/** Aléatoire de test : renvoie toujours la même valeur. */
final readonly class FixedRandom implements Random
{
    public function __construct(private float $value)
    {
    }

    public function next(): float
    {
        return $this->value;
    }
}
