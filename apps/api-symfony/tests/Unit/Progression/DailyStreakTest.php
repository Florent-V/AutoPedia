<?php

declare(strict_types=1);

namespace App\Tests\Unit\Progression;

use App\Progression\Entity\DailyStreak;
use App\Shared\Domain\Exception\RuleViolation;
use App\Tests\Support\Hydrate;
use PHPUnit\Framework\TestCase;

final class DailyStreakTest extends TestCase
{
    private static function streak(int $n, ?string $lastClaim): DailyStreak
    {
        return Hydrate::make(DailyStreak::class, ['dailyStreak' => $n, 'bestStreak' => $n, 'lastDailyClaim' => $lastClaim]);
    }

    public function testUneSeuleReclamationParJour(): void
    {
        $s = self::streak(0, null);
        self::assertSame(1, $s->claim('2026-03-02', '2026-03-01')->day);
        $this->expectException(RuleViolation::class);
        $s->claim('2026-03-02', '2026-03-01');
    }

    public function testContinueLaSerieEtBoucleApresSeptJours(): void
    {
        $reward = self::streak(6, '2026-03-01')->claim('2026-03-02', '2026-03-01');
        self::assertSame(7, $reward->day);
        self::assertTrue($reward->topCard);
        self::assertSame(1, self::streak(7, '2026-03-01')->claim('2026-03-02', '2026-03-01')->day);
    }

    public function testRepartAUnApresUnJourManqueEnGardantLaMeilleureSerie(): void
    {
        $s = self::streak(5, '2026-02-27');
        self::assertSame(['canClaim' => true, 'streak' => 0, 'best' => 5, 'day' => 1], $s->status('2026-03-02', '2026-03-01'));
        self::assertSame(1, $s->claim('2026-03-02', '2026-03-01')->day);
        self::assertSame(1, $s->current());
        self::assertSame(5, $s->best());
    }
}
