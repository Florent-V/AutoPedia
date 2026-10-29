<?php

declare(strict_types=1);

namespace App\Statistics\Service;

use App\Catalog\Domain\Rarity;
use Doctrine\DBAL\Connection;

/**
 * Modèle de lecture : statistiques d'un joueur (collection, crédits, compteurs), pour l'affichage et les succès.
 * Lit dans la transaction en cours s'il y en a une (même connexion Doctrine).
 */
final class PlayerStats
{
    public function __construct(private readonly Connection $db)
    {
    }

    /** @return array<string, int> */
    public function forUser(string $userId): array
    {
        $rarity = 'COALESCE(c."rarityOverride", c."rarity")';
        $points = 'CASE '.implode(' ', array_map(static fn (Rarity $r) => "WHEN $rarity = '{$r->value}' THEN {$r->points()}", Rarity::cases())).' ELSE 0 END';
        $row = $this->db->fetchAssociative(<<<SQL
            SELECT COUNT(*) AS "uniqueCards",
                   COALESCE(SUM($points), 0) AS "points",
                   COUNT(*) FILTER (WHERE $rarity = 'COMMON') AS "common",
                   COUNT(*) FILTER (WHERE $rarity = 'UNCOMMON') AS "uncommon",
                   COUNT(*) FILTER (WHERE $rarity = 'RARE') AS "rare",
                   COUNT(*) FILTER (WHERE $rarity = 'EPIC') AS "epic",
                   COUNT(*) FILTER (WHERE $rarity = 'LEGENDARY') AS "legendary",
                   COUNT(*) FILTER (WHERE c."racing") AS "racing",
                   COUNT(DISTINCT c."country") AS "countries",
                   COUNT(DISTINCT (c."yearStart" / 10)) AS "decades",
                   COALESCE(MAX(uc."quantity"), 0) AS "maxQuantity"
            FROM "user_card" uc JOIN "car" c ON c."id" = uc."carId"
            WHERE uc."userId" = :id
            SQL, ['id' => $userId]) ?: [];
        $maxPerBrand = $this->db->fetchOne(<<<'SQL'
            SELECT COALESCE(MAX(n), 0) FROM (
              SELECT COUNT(*) AS n FROM "user_card" uc JOIN "car" c ON c."id" = uc."carId"
              WHERE uc."userId" = :id AND c."manufacturer" IS NOT NULL GROUP BY c."manufacturer") t
            SQL, ['id' => $userId]);
        $p = $this->db->fetchAssociative('SELECT * FROM "player" WHERE "userId" = :id', ['id' => $userId]) ?: [];
        $int = static fn (string $key, array $from) => (int) ($from[$key] ?? 0);

        return [
            'boostersOpened' => $int('boostersOpened', $p),
            'cardsObtained' => $int('cardsObtained', $p),
            'uniqueCards' => $int('uniqueCards', $row),
            'points' => $int('points', $row),
            'common' => $int('common', $row),
            'uncommon' => $int('uncommon', $row),
            'rare' => $int('rare', $row),
            'epic' => $int('epic', $row),
            'legendary' => $int('legendary', $row),
            'racing' => $int('racing', $row),
            'maxPerBrand' => (int) $maxPerBrand,
            'countries' => $int('countries', $row),
            'decades' => $int('decades', $row),
            'maxQuantity' => $int('maxQuantity', $row),
            'credits' => $int('credits', $p),
            'creditsEarned' => $int('creditsEarned', $p),
            'gamesPlayed' => $int('gamesPlayed', $p),
            'tradesCompleted' => $int('tradesCompleted', $p),
            'shopPurchases' => $int('shopPurchases', $p),
            'gameCardsWon' => $int('gameCardsWon', $p),
            'doorsJackpots' => $int('doorsJackpots', $p),
            'auctionsWon' => $int('auctionsWon', $p),
            'auctionsSold' => $int('auctionsSold', $p),
            'bestStreak' => $int('bestStreak', $p),
        ];
    }
}
