<?php

declare(strict_types=1);

namespace App\Tests\Unit\Collection;

use App\Catalog\Domain\Rarity;
use App\Collection\Domain\BoosterRules;
use App\Collection\Domain\Pity;
use App\Collection\Entity\BoosterReserve;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use App\Tests\Support\Hydrate;
use PHPUnit\Framework\TestCase;

final class BoosterReserveTest extends TestCase
{
    private const MIN = 60_000;
    private BoosterRules $rules;
    private \DateTimeImmutable $t0;

    protected function setUp(): void
    {
        $this->rules = new BoosterRules(max: 10, regenMs: 30 * self::MIN, cardsPerBooster: 5, pityEpic: 10, pityLegendary: 60);
        $this->t0 = new \DateTimeImmutable('2026-01-01T00:00:00Z');
    }

    private function at(int $minutes): \DateTimeImmutable
    {
        return $this->t0->modify("+$minutes minutes");
    }

    private function reserve(int $boosters, int $sinceEpic = 0, int $sinceLegendary = 0): BoosterReserve
    {
        return Hydrate::make(BoosterReserve::class, ['boosters' => $boosters, 'boosterAnchor' => $this->t0, 'sinceEpic' => $sinceEpic, 'sinceLegendary' => $sinceLegendary]);
    }

    public function testRegenereUnBoosterParIntervalle(): void
    {
        $s = $this->reserve(2)->status($this->at(65), $this->rules);
        self::assertSame(4, $s->boosters);
        self::assertEquals($this->at(60), $s->anchor);
        self::assertEquals($this->at(90), $s->nextAt);
    }

    public function testPlafonneAuMaximumEtFigeLeMinuteur(): void
    {
        $s = $this->reserve(8)->status($this->at(500), $this->rules);
        self::assertSame(10, $s->boosters);
        self::assertNull($s->nextAt);
    }

    public function testOuvrirDepuisUneReservePleineRelanceLeMinuteur(): void
    {
        $after = $this->reserve(10)->consume($this->at(100), $this->rules);
        self::assertSame(9, $after->boosters);
        self::assertEquals($this->at(130), $after->nextAt);
    }

    public function testGardeLeMinuteurEnCoursQuandLaReserveNEstPasPleine(): void
    {
        $after = $this->reserve(5)->consume($this->at(10), $this->rules);
        self::assertSame(4, $after->boosters);
        self::assertEquals($this->at(30), $after->nextAt);
    }

    public function testRegenereAvantDeConsommer(): void
    {
        self::assertSame(0, $this->reserve(0)->consume($this->at(30), $this->rules)->boosters);
    }

    public function testRefuseDOuvrirUneReserveVide(): void
    {
        $this->expectException(RuleViolation::class);
        $this->reserve(0)->consume($this->at(10), $this->rules);
    }

    public function testMetAJourLesGarantiesSelonLeContenu(): void
    {
        $r = $this->reserve(5, sinceEpic: 9, sinceLegendary: 59);
        self::assertEquals(new Pity(epic: true, legendary: true), $r->pity($this->rules));
        $r->recordOpening([Rarity::COMMON, Rarity::EPIC]);
        self::assertSame(['epicIn' => 10, 'legendaryIn' => 1], $r->pityCountdown($this->rules));
        self::assertSame(1, $r->boostersOpened());
        self::assertSame(2, $r->cardsObtained());
        $r->recordOpening([Rarity::LEGENDARY]);
        self::assertSame(['epicIn' => 10, 'legendaryIn' => 60], $r->pityCountdown($this->rules));
    }

    public function testPeutDepasserLeMaximumAvecDesBoostersOfferts(): void
    {
        $r = $this->reserve(10);
        self::assertSame(13, $r->grant(3, $this->t0, $this->rules)->boosters);
        $this->expectException(InvalidRequest::class);
        $r->grant(0, $this->t0, $this->rules);
    }
}
