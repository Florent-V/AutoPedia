<?php

declare(strict_types=1);

namespace App\Marketplace\Service;

use App\Marketplace\Domain\MarketPolicy;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\Exception\DomainException;
use App\Shared\Domain\Exception\NotFound;
use Doctrine\DBAL\Connection;

/** Applique la politique du marché au joueur (ancienneté du compte, activité). */
final class MarketAccess
{
    public readonly MarketPolicy $policy;

    public function __construct(private readonly Connection $db, GameSettings $settings)
    {
        $this->policy = MarketPolicy::from($settings);
    }

    public function assert(string $userId, \DateTimeImmutable $now): void
    {
        $row = $this->db->fetchAssociative(
            'SELECT u."createdAt", p."boostersOpened", p."isBot" FROM "player" p JOIN "user" u ON u."id" = p."userId" WHERE p."userId" = ?',
            [$userId],
        ) ?: throw new NotFound('Joueur introuvable');
        $this->policy->assertCanTrade(new \DateTimeImmutable($row['createdAt'], new \DateTimeZone('UTC')), (int) $row['boostersOpened'], (bool) $row['isBot'], $now);
    }

    /** @return array{canTrade: bool, reason: ?string, priceFloor: array<string, int>, maxSwapRarityGap: int} */
    public function describe(string $userId, \DateTimeImmutable $now): array
    {
        $reason = null;
        try {
            $this->assert($userId, $now);
        } catch (DomainException $e) {
            $reason = $e->getMessage();
        }

        return ['canTrade' => null === $reason, 'reason' => $reason, 'priceFloor' => $this->policy->priceFloors(), 'maxSwapRarityGap' => $this->policy->maxSwapRarityGap];
    }
}
