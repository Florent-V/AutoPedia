<?php

declare(strict_types=1);

namespace App\Progression\Domain;

/** Récompense d'un jour du cycle de 7 jours consécutifs. */
final readonly class DailyReward
{
    public function __construct(
        public int $day,
        public int $credits,
        public int $boosters,
        /** Carte Épique (ou Légendaire, 1 fois sur 5). */
        public bool $topCard,
        public string $label,
    ) {
    }

    /** @return list<self> le cycle ; il recommence au jour 1 après le 7e jour, ou après un jour manqué */
    public static function cycle(): array
    {
        return [
            new self(1, 50, 0, false, '50 crédits'),
            new self(2, 0, 1, false, '1 booster'),
            new self(3, 100, 0, false, '100 crédits'),
            new self(4, 0, 2, false, '2 boosters'),
            new self(5, 150, 0, false, '150 crédits'),
            new self(6, 0, 3, false, '3 boosters'),
            new self(7, 200, 0, true, '200 crédits + 1 carte Épique'),
        ];
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return ['day' => $this->day, 'credits' => $this->credits, 'boosters' => $this->boosters, 'topCard' => $this->topCard, 'label' => $this->label];
    }
}
