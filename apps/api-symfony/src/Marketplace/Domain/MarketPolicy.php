<?php

declare(strict_types=1);

namespace App\Marketplace\Domain;

use App\Catalog\Domain\Rarity;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\Exception\RuleViolation;

/**
 * Garde-fous contre les comptes multiples : sans eux, on pourrait créer des comptes jetables,
 * récupérer leurs boosters et crédits de bienvenue, puis tout transférer vers son compte principal.
 */
final readonly class MarketPolicy
{
    private const PRICE_FLOOR = ['COMMON' => 5, 'UNCOMMON' => 15, 'RARE' => 50, 'EPIC' => 150, 'LEGENDARY' => 500];

    public function __construct(
        public int $minAccountHours,
        public int $minBoostersOpened,
        public int $maxSwapRarityGap,
    ) {
    }

    public static function from(GameSettings $s): self
    {
        return new self($s->marketMinAccountHours, $s->marketMinBoosters, $s->tradeMaxRarityGap);
    }

    /** @return array<string, int> */
    public function priceFloors(): array
    {
        return self::PRICE_FLOOR;
    }

    /** Le joueur peut-il utiliser la bourse et les enchères ? (les bots, pilotés par le serveur, sont exemptés) */
    public function assertCanTrade(\DateTimeImmutable $accountCreatedAt, int $boostersOpened, bool $isBot, \DateTimeImmutable $now): void
    {
        if ($isBot) {
            return;
        }
        $readyAt = $accountCreatedAt->modify("+{$this->minAccountHours} hours");
        if ($readyAt > $now) {
            $hours = (int) ceil(($readyAt->getTimestamp() - $now->getTimestamp()) / 3600);
            throw new RuleViolation("Le marché s’ouvre aux nouveaux comptes après {$this->minAccountHours} h : encore $hours h à patienter");
        }
        if ($boostersOpened < $this->minBoostersOpened) {
            throw new RuleViolation("Ouvrez au moins {$this->minBoostersOpened} boosters avant d’accéder au marché");
        }
    }

    public function assertPriceFloor(Rarity $rarity, int $price): void
    {
        $floor = self::PRICE_FLOOR[$rarity->value];
        if ($price < $floor) {
            throw new RuleViolation(\sprintf('Prix trop bas : au moins %d crédits pour une carte %s', $floor, mb_strtolower($rarity->label())));
        }
    }

    public function assertFairSwap(Rarity $offered, Rarity $wanted): void
    {
        if (abs($offered->rank() - $wanted->rank()) > $this->maxSwapRarityGap) {
            throw new RuleViolation('Échange refusé : les deux cartes doivent être de raretés proches');
        }
    }
}
