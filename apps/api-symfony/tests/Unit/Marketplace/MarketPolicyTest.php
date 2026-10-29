<?php

declare(strict_types=1);

namespace App\Tests\Unit\Marketplace;

use App\Catalog\Domain\Rarity;
use App\Marketplace\Domain\MarketPolicy;
use App\Shared\Domain\Exception\RuleViolation;
use PHPUnit\Framework\TestCase;

final class MarketPolicyTest extends TestCase
{
    private MarketPolicy $policy;
    private \DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->policy = new MarketPolicy(minAccountHours: 24, minBoostersOpened: 3, maxSwapRarityGap: 1);
        $this->now = new \DateTimeImmutable('2026-06-10T12:00:00Z');
    }

    private function hoursAgo(int $h): \DateTimeImmutable
    {
        return $this->now->modify("-$h hours");
    }

    /** @param callable(): void $fn */
    private function assertRefused(callable $fn): void
    {
        try {
            $fn();
            self::fail('RuleViolation attendue');
        } catch (RuleViolation) {
            $this->addToAssertionCount(1);
        }
    }

    public function testFermeLeMarcheAuxComptesRecentsOuInactifsSaufAuxBots(): void
    {
        $this->assertRefused(fn () => $this->policy->assertCanTrade($this->hoursAgo(2), 10, false, $this->now));
        $this->assertRefused(fn () => $this->policy->assertCanTrade($this->hoursAgo(48), 2, false, $this->now));
        $this->policy->assertCanTrade($this->hoursAgo(48), 3, false, $this->now);
        $this->policy->assertCanTrade($this->hoursAgo(0), 0, true, $this->now);
    }

    public function testImposeUnPrixPlancherSelonLaRarete(): void
    {
        $this->assertRefused(fn () => $this->policy->assertPriceFloor(Rarity::LEGENDARY, 1));
        $this->policy->assertPriceFloor(Rarity::LEGENDARY, 500);
        $this->policy->assertPriceFloor(Rarity::COMMON, 5);
    }

    public function testRefuseLesEchangesTropDesequilibres(): void
    {
        $this->assertRefused(fn () => $this->policy->assertFairSwap(Rarity::LEGENDARY, Rarity::COMMON));
        $this->policy->assertFairSwap(Rarity::RARE, Rarity::EPIC);
        $this->policy->assertFairSwap(Rarity::UNCOMMON, Rarity::UNCOMMON);
    }
}
