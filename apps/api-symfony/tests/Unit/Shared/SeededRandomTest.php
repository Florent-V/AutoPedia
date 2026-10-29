<?php

declare(strict_types=1);

namespace App\Tests\Unit\Shared;

use App\Shared\Domain\SeededRandom;
use App\Shared\Domain\Shuffle;
use PHPUnit\Framework\TestCase;

final class SeededRandomTest extends TestCase
{
    /** Même graine, même suite que le seededRandom() de NestJS (valeurs relevées côté Node). */
    public function testProduitLaMemeSuiteQueNestJs(): void
    {
        $r = new SeededRandom('graine');
        foreach ([0.219154990278, 0.080920528155, 0.611233768985] as $expected) {
            self::assertEqualsWithDelta($expected, $r->next(), 1e-12);
        }
    }

    public function testMelangeDeterministe(): void
    {
        $items = range(0, 49);
        $a = Shuffle::of($items, new SeededRandom('graine'));
        self::assertSame($a, Shuffle::of($items, new SeededRandom('graine')));
        self::assertNotSame($a, Shuffle::of($items, new SeededRandom('autre')));
        sort($a);
        self::assertSame($items, $a);
    }
}
