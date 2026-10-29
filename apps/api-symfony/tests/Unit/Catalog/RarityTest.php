<?php

declare(strict_types=1);

namespace App\Tests\Unit\Catalog;

use App\Catalog\Domain\Rarity;
use App\Shared\Domain\CryptoRandom;
use PHPUnit\Framework\TestCase;

final class RarityTest extends TestCase
{
    public function testAttribueLesRaretesSelonLaNotoriete(): void
    {
        $map = Rarity::assign(range(0, 99));
        self::assertSame(Rarity::LEGENDARY, $map[0]);
        self::assertSame(Rarity::LEGENDARY, $map[1]);
        self::assertSame(Rarity::EPIC, $map[2]);
        self::assertSame(Rarity::COMMON, $map[99]);
        $counts = array_count_values(array_map(fn (Rarity $r) => $r->value, $map));
        self::assertSame(['LEGENDARY' => 2, 'EPIC' => 6, 'RARE' => 15, 'UNCOMMON' => 27, 'COMMON' => 50], $counts);
    }

    public function testAuMoinsUneLegendaireSurUnPetitCatalogue(): void
    {
        $map = Rarity::assign([7, 8, 9]);
        self::assertSame(Rarity::LEGENDARY, $map[7]);
        self::assertCount(3, $map);
    }

    public function testSeRabatSurLaRareteLaPlusProche(): void
    {
        self::assertSame([Rarity::RARE, Rarity::UNCOMMON, Rarity::EPIC, Rarity::COMMON, Rarity::LEGENDARY], Rarity::RARE->nearest());
        self::assertSame([Rarity::LEGENDARY, Rarity::EPIC, Rarity::RARE, Rarity::UNCOMMON, Rarity::COMMON], Rarity::LEGENDARY->nearest());
    }

    public function testJamaisDeCommuneDansLEmplacementVedette(): void
    {
        $random = new CryptoRandom();
        for ($i = 0; $i < 1000; ++$i) {
            self::assertNotSame(Rarity::COMMON, Rarity::roll(true, $random));
        }
    }
}
