<?php

declare(strict_types=1);

namespace App\Tests\Unit\Bots;

use App\Bots\Domain\BotBrain;
use App\Bots\Domain\BotProfile;
use App\Bots\Domain\CardFacts;
use App\Catalog\Domain\Rarity;
use App\Shared\Domain\CryptoRandom;
use App\Tests\Support\FixedRandom;
use PHPUnit\Framework\TestCase;

final class BotBrainTest extends TestCase
{
    private static function profile(string $style, ?string $favoriteBrand = null): BotProfile
    {
        return BotProfile::create($style, 20, $favoriteBrand, false);
    }

    public function testValoriseDavantageLesCartesManquantesQueLesDoublons(): void
    {
        $brain = new BotBrain(new FixedRandom(0.5));
        $p = self::profile('collectionneur');
        $card = new CardFacts(Rarity::RARE, 'Ferrari', false);
        self::assertGreaterThan($brain->valuation($p, $card, 1), $brain->valuation($p, $card, 0));
        self::assertGreaterThan($brain->valuation($p, $card, 3), $brain->valuation($p, $card, 1));
    }

    public function testPaieUnSupplementPourSaMarqueFavorite(): void
    {
        $brain = new BotBrain(new FixedRandom(0.5));
        $p = self::profile('passionne', 'Porsche');
        $fav = $brain->valuation($p, new CardFacts(Rarity::EPIC, 'Porsche', false), 0);
        $other = $brain->valuation($p, new CardFacts(Rarity::EPIC, 'Fiat', false), 0);
        self::assertEqualsWithDelta(1.8, $fav / $other, 0.05);
    }

    public function testNEncheritJamaisAuDelaDeSaValeur(): void
    {
        $p = self::profile('marchand');
        self::assertNull((new BotBrain(new FixedRandom(0)))->decideBid($p, 100, 150, 3_600_000, false));
        $brain = new BotBrain(new CryptoRandom());
        for ($i = 0; $i < 200; ++$i) {
            $bid = $brain->decideBid($p, 500, 300, 3_600_000, false);
            if (null !== $bid) {
                self::assertGreaterThanOrEqual(300, $bid);
                self::assertLessThanOrEqual(500, $bid);
            }
        }
    }

    public function testNEncheritPasSystematiquement(): void
    {
        $brain = new BotBrain(new CryptoRandom());
        $p = self::profile('econome');
        $bids = 0;
        for ($i = 0; $i < 1000; ++$i) {
            $bids += null === $brain->decideBid($p, 1000, 900, 3_600_000, false) ? 0 : 1;
        }
        self::assertGreaterThan(100, $bids);
        self::assertLessThan(700, $bids);
    }

    public function testNAccepteQueLesEchangesEquitables(): void
    {
        $brain = new BotBrain(new FixedRandom(0));
        $p = self::profile('marchand');
        $ref = BotBrain::REF_VALUE;
        self::assertFalse($brain->acceptsPriceOffer($p, 100, 95));
        self::assertTrue($brain->acceptsPriceOffer($p, 100, 80));
        self::assertFalse($brain->acceptsSwap($p, $ref['EPIC'], $ref['RARE'], 1)); // garde son dernier exemplaire
        self::assertTrue($brain->acceptsSwap($p, $ref['EPIC'], $ref['RARE'], 2));
        self::assertFalse($brain->acceptsSwap($p, $ref['COMMON'], $ref['RARE'], 5));
    }
}
