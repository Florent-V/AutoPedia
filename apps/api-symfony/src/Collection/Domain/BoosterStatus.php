<?php

declare(strict_types=1);

namespace App\Collection\Domain;

use App\Shared\Domain\Iso;

/** État calculé de la réserve à un instant donné. */
final readonly class BoosterStatus
{
    public function __construct(
        public int $boosters,
        public \DateTimeImmutable $anchor,
        public int $max,
        public int $regenMs,
        /** Prochain booster gagné, null si la réserve est pleine. */
        public ?\DateTimeImmutable $nextAt,
    ) {
    }

    /** @return array<string, mixed> vue envoyée au client (le compte à rebours utilise l'heure du serveur) */
    public function view(\DateTimeImmutable $now): array
    {
        return [
            'available' => $this->boosters,
            'max' => $this->max,
            'regenMs' => $this->regenMs,
            'nextAt' => Iso::format($this->nextAt),
            'serverTime' => Iso::format($now),
        ];
    }
}
