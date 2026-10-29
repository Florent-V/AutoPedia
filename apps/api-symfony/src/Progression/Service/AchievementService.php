<?php

declare(strict_types=1);

namespace App\Progression\Service;

use App\Player\Repository\PlayerRepository;
use App\Progression\Domain\Achievement;
use App\Shared\Domain\Iso;
use App\Shared\Transaction\UnitOfWork;
use App\Statistics\Service\PlayerStats;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Doctrine\DBAL\Connection;

final class AchievementService
{
    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly Connection $db,
        private readonly PlayerStats $stats,
        private readonly WalletService $wallet,
        private readonly AchievementUnlocks $unlocks,
    ) {
    }

    /**
     * Débloque les succès atteints et verse leur récompense, dans la transaction en cours.
     * La récompense n'est versée que si l'insertion a vraiment eu lieu (ON CONFLICT DO NOTHING RETURNING) :
     * deux évaluations simultanées ne peuvent pas payer deux fois le même succès.
     *
     * @return list<Achievement>
     */
    public function evaluate(string $userId): array
    {
        return $this->uow->run(function () use ($userId) {
            $this->players->lock($userId);
            $unlocked = $this->db->fetchFirstColumn('SELECT "achievementId" FROM "user_achievement" WHERE "userId" = ?', [$userId]);
            $fresh = [];
            foreach (Achievement::reached($this->stats->forUser($userId), $unlocked) as $achievement) {
                $inserted = $this->db->fetchOne(
                    'INSERT INTO "user_achievement" ("userId", "achievementId", "unlockedAt") VALUES (?, ?, now()) ON CONFLICT DO NOTHING RETURNING "achievementId"',
                    [$userId, $achievement->id],
                );
                if (false === $inserted) {
                    continue;
                }
                $this->wallet->credit($userId, $achievement->reward(), LedgerReason::ACHIEVEMENT, $achievement->id);
                $fresh[] = $achievement;
            }
            $this->unlocks->record($userId, $fresh);

            return $fresh;
        });
    }

    /** @return array<string, mixed> */
    public function list(string $userId): array
    {
        // Rattrapage : un succès atteint mais pas encore enregistré est débloqué (et payé) à l'affichage.
        $this->evaluate($userId);
        $stats = $this->stats->forUser($userId);
        $unlockedAt = [];
        foreach ($this->db->fetchAllAssociative('SELECT "achievementId", "unlockedAt" FROM "user_achievement" WHERE "userId" = ?', [$userId]) as $row) {
            $unlockedAt[$row['achievementId']] = Iso::format(new \DateTimeImmutable($row['unlockedAt']));
        }

        return [
            'unlocked' => \count($unlockedAt),
            'total' => \count(Achievement::all()),
            'achievements' => array_map(static fn (Achievement $a) => $a->toArray() + [
                'reward' => $a->reward(),
                'progress' => min($stats[$a->stat] ?? 0, $a->goal),
                'unlockedAt' => $unlockedAt[$a->id] ?? null,
            ], Achievement::all()),
        ];
    }
}
