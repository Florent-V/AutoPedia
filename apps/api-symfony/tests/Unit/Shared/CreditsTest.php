<?php

declare(strict_types=1);

namespace App\Tests\Unit\Shared;

use App\Shared\Domain\Credits;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use PHPUnit\Framework\TestCase;

final class CreditsTest extends TestCase
{
    public function testRefuseLesMontantsNegatifsOuDemesures(): void
    {
        foreach ([fn () => Credits::of(-1), fn () => Credits::of(2_000_000_000), fn () => Credits::of(10)->add(0), fn () => Credits::of(10)->subtract(-5)] as $bad) {
            try {
                $bad();
                self::fail('InvalidRequest attendue');
            } catch (InvalidRequest) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function testNeDescendJamaisSousZero(): void
    {
        self::assertSame(0, Credits::of(10)->subtract(10)->value);
        $this->expectException(RuleViolation::class);
        Credits::of(10)->subtract(11);
    }

    public function testAdditionneSansDepasserLePlafond(): void
    {
        self::assertSame(15, Credits::of(10)->add(5)->value);
        $this->expectException(RuleViolation::class);
        Credits::of(999_999_999)->add(2);
    }
}
