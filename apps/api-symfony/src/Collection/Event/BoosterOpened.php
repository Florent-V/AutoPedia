<?php

declare(strict_types=1);

namespace App\Collection\Event;

/** Un joueur a ouvert un booster. */
final readonly class BoosterOpened
{
    /** @param list<int> $carIds */
    public function __construct(public string $userId, public array $carIds)
    {
    }
}
