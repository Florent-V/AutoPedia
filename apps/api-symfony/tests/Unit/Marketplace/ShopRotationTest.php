<?php

declare(strict_types=1);

namespace App\Tests\Unit\Marketplace;

use App\Marketplace\Domain\ShopRotation;
use PHPUnit\Framework\TestCase;

final class ShopRotationTest extends TestCase
{
    /** @var array<string, list<int>> */
    private array $pool;

    protected function setUp(): void
    {
        $this->pool = [
            'COMMON' => range(1, 200),
            'UNCOMMON' => range(1000, 1099),
            'RARE' => range(2000, 2049),
            'EPIC' => range(3000, 3019),
            'LEGENDARY' => range(4000, 4005),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function offers(int $hour): array
    {
        return ShopRotation::offersAt($this->pool, 's', '2026-10-15', $hour);
    }

    /** Même graine, même boutique que NestJS (programme relevé côté Node) : les deux backends sont interchangeables. */
    public function testProduitLeMemeProgrammeQueNestJs(): void
    {
        self::assertSame([
            ['offerKey' => '2026-10-15T14:COMMON:0', 'rarity' => 'COMMON', 'carId' => 174, 'price' => 40, 'basePrice' => 40, 'deal' => false, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:COMMON:1', 'rarity' => 'COMMON', 'carId' => 95, 'price' => 40, 'basePrice' => 40, 'deal' => false, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:COMMON:2', 'rarity' => 'COMMON', 'carId' => 102, 'price' => 40, 'basePrice' => 40, 'deal' => false, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:UNCOMMON:0', 'rarity' => 'UNCOMMON', 'carId' => 1064, 'price' => 120, 'basePrice' => 120, 'deal' => false, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:UNCOMMON:1', 'rarity' => 'UNCOMMON', 'carId' => 1029, 'price' => 120, 'basePrice' => 120, 'deal' => false, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:RARE:0', 'rarity' => 'RARE', 'carId' => 2033, 'price' => 300, 'basePrice' => 400, 'deal' => true, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:RARE:1', 'rarity' => 'RARE', 'carId' => 2007, 'price' => 400, 'basePrice' => 400, 'deal' => false, 'untilHour' => 15],
            ['offerKey' => '2026-10-15T14:EPIC:0', 'rarity' => 'EPIC', 'carId' => 3005, 'price' => 1200, 'basePrice' => 1200, 'deal' => false, 'untilHour' => 16],
            ['offerKey' => '2026-10-15T12:LEGENDARY:0', 'rarity' => 'LEGENDARY', 'carId' => 4001, 'price' => 4000, 'basePrice' => 4000, 'deal' => false, 'untilHour' => 16],
        ], $this->offers(14));
    }

    public function testStableDansLHeureEtDifferenteLHeureSuivante(): void
    {
        $commons = fn (array $offers) => array_column(array_filter($offers, fn ($o) => 'COMMON' === $o['rarity']), 'carId');
        self::assertSame($this->offers(14), $this->offers(14));
        self::assertNotSame($commons($this->offers(14)), $commons($this->offers(15)));
    }

    public function testNeRepetePasUneCommuneDansLaJournee(): void
    {
        $ids = [];
        for ($h = 0; $h < 24; ++$h) {
            foreach ($this->offers($h) as $o) {
                if ('COMMON' === $o['rarity']) {
                    $ids[] = $o['carId'];
                }
            }
        }
        self::assertSame(\count($ids), \count(array_unique($ids)));
    }

    public function testGardeLesLegendairesQuatreHeuresAvecUneCleCommune(): void
    {
        $at = fn (int $h) => array_values(array_filter($this->offers($h), fn ($o) => 'LEGENDARY' === $o['rarity']))[0];
        self::assertSame($at(8)['offerKey'], $at(11)['offerKey']);
        self::assertSame(12, $at(8)['untilHour']);
        self::assertNotSame($at(11)['offerKey'], $at(12)['offerKey']);
    }

    public function testUneSeulePromotionParHeure(): void
    {
        $deals = array_values(array_filter($this->offers(9), fn ($o) => $o['deal']));
        self::assertCount(1, $deals);
        self::assertLessThan($deals[0]['basePrice'], $deals[0]['price']);
    }
}
