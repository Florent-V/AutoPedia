<?php

declare(strict_types=1);

namespace App\Player\Service;

use App\Shared\Config\GameSettings;
use Doctrine\DBAL\Connection;

/**
 * Crée la fiche « player » d'un compte (réserve de départ, crédits de bienvenue), une seule fois,
 * même si deux requêtes arrivent en même temps (INSERT … ON CONFLICT DO NOTHING).
 */
final class PlayerProvisioning
{
    /** @var array<string, true> comptes dont la fiche existe déjà (évite une requête à chaque appel) */
    private array $known = [];

    public function __construct(private readonly Connection $db, private readonly GameSettings $settings)
    {
    }

    public function ensure(string $userId): void
    {
        if (isset($this->known[$userId])) {
            return;
        }
        $this->db->executeStatement(
            'INSERT INTO "player" ("userId", "boosters", "credits", "updatedAt") VALUES (:id, :boosters, :credits, now()) ON CONFLICT DO NOTHING',
            ['id' => $userId, 'boosters' => min($this->settings->boosterStart, $this->settings->boosterMax), 'credits' => $this->settings->startingCredits],
        );
        if (\count($this->known) > 100_000) {
            $this->known = [];
        }
        $this->known[$userId] = true;
    }
}
