<?php

declare(strict_types=1);

namespace App\Tests\Unit\Shared;

use App\Shared\Domain\GameCalendar;
use App\Shared\Domain\Iso;
use PHPUnit\Framework\TestCase;

final class GameCalendarTest extends TestCase
{
    private GameCalendar $paris;

    protected function setUp(): void
    {
        $this->paris = new GameCalendar('Europe/Paris');
    }

    public function testHeureDEte(): void
    {
        $at = new \DateTimeImmutable('2026-07-01T22:30:00Z'); // 00:30 à Paris
        self::assertSame('2026-07-02', $this->paris->day($at));
        self::assertSame(0, $this->paris->hour($at));
        self::assertSame('2026-07-01T22:00:00.000Z', Iso::format($this->paris->startOfDay($at)));
    }

    public function testHeureDHiver(): void
    {
        $at = new \DateTimeImmutable('2026-12-01T10:15:20Z'); // 11:15:20 à Paris
        self::assertSame(11, $this->paris->hour($at));
        self::assertSame('2026-11-30T23:00:00.000Z', Iso::format($this->paris->startOfDay($at)));
        self::assertSame('2026-12-01T11:00:00.000Z', Iso::format($this->paris->nextHour($at)));
        self::assertSame('2026-11-30', $this->paris->yesterday($at));
    }
}
