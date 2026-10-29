<?php

declare(strict_types=1);

namespace App\Collection\Domain;

use App\Shared\Config\GameSettings;

final readonly class BoosterRules
{
    public function __construct(
        public int $max,
        public int $regenMs,
        public int $cardsPerBooster,
        public int $pityEpic,
        public int $pityLegendary,
    ) {
    }

    public static function from(GameSettings $s): self
    {
        return new self($s->boosterMax, $s->boosterRegenMs, $s->cardsPerBooster, $s->pityEpic, $s->pityLegendary);
    }
}
