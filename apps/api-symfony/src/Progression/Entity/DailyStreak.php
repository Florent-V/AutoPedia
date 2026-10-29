<?php

declare(strict_types=1);

namespace App\Progression\Entity;

use App\Progression\Domain\DailyReward;
use App\Shared\Domain\Exception\RuleViolation;
use Doctrine\ORM\Mapping as ORM;

/** Série de jours consécutifs de récompense quotidienne. Les dates viennent de l'horloge du serveur. */
#[ORM\Embeddable]
class DailyStreak
{
    #[ORM\Column]
    private int $dailyStreak = 0;

    #[ORM\Column]
    private int $bestStreak = 0;

    /** Dernier jour réclamé (AAAA-MM-JJ dans le fuseau du jeu). */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastDailyClaim = null;

    /** @return array{canClaim: bool, streak: int, best: int, day: int} */
    public function status(string $today, string $yesterday): array
    {
        $claimedToday = $this->lastDailyClaim === $today;
        $alive = $claimedToday || $this->lastDailyClaim === $yesterday;
        $streak = $alive ? $this->dailyStreak : 0;

        return [
            'canClaim' => !$claimedToday,
            'streak' => $streak,
            'best' => $this->bestStreak,
            'day' => $claimedToday ? (($streak - 1) % 7) + 1 : ($streak % 7) + 1,
        ];
    }

    /** Réclame la récompense du jour ; 409 si elle l'a déjà été. */
    public function claim(string $today, string $yesterday): DailyReward
    {
        if ($this->lastDailyClaim === $today) {
            throw new RuleViolation('Récompense du jour déjà réclamée : revenez demain !');
        }
        $this->dailyStreak = $this->lastDailyClaim === $yesterday ? $this->dailyStreak + 1 : 1;
        $this->bestStreak = max($this->bestStreak, $this->dailyStreak);
        $this->lastDailyClaim = $today;

        return DailyReward::cycle()[($this->dailyStreak - 1) % 7];
    }

    public function current(): int
    {
        return $this->dailyStreak;
    }

    public function best(): int
    {
        return $this->bestStreak;
    }
}
