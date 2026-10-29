<?php

declare(strict_types=1);

namespace App\Progression\Service;

use App\Progression\Domain\Achievement;
use Symfony\Contracts\Service\ResetInterface;

/**
 * Succès débloqués pendant la requête en cours (par n'importe quel contexte, via les événements).
 * NewAchievementsListener les ajoute à la réponse du joueur concerné. Vidé entre deux messages (ResetInterface).
 */
final class AchievementUnlocks implements ResetInterface
{
    /** @var list<array{userId: string, achievement: Achievement}> */
    private array $bag = [];

    /** @param list<Achievement> $list */
    public function record(string $userId, array $list): void
    {
        foreach ($list as $achievement) {
            $this->bag[] = ['userId' => $userId, 'achievement' => $achievement];
        }
    }

    /** @return list<array<string, mixed>> */
    public function forUser(string $userId): array
    {
        $out = [];
        foreach ($this->bag as $entry) {
            if ($entry['userId'] === $userId) {
                $out[] = $entry['achievement']->toArray() + ['reward' => $entry['achievement']->reward()];
            }
        }

        return $out;
    }

    public function reset(): void
    {
        $this->bag = [];
    }
}
