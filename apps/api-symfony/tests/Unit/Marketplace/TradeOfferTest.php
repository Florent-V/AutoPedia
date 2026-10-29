<?php

declare(strict_types=1);

namespace App\Tests\Unit\Marketplace;

use App\Marketplace\Entity\TradeOffer;
use App\Shared\Domain\Exception\DomainException;
use App\Shared\Domain\Exception\Forbidden;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use PHPUnit\Framework\TestCase;

final class TradeOfferTest extends TestCase
{
    private \DateTimeImmutable $t0;

    protected function setUp(): void
    {
        $this->t0 = new \DateTimeImmutable('2026-06-01T12:00:00Z');
    }

    private function create(?int $wantedCarId = null, ?int $price = null): TradeOffer
    {
        return new TradeOffer('s', 1, $wantedCarId, $price, $this->t0, 7);
    }

    /**
     * @param class-string<DomainException> $class
     * @param callable(): mixed             $fn
     */
    private function assertThrows(string $class, callable $fn): void
    {
        try {
            $fn();
            self::fail("$class attendue");
        } catch (DomainException $e) {
            self::assertInstanceOf($class, $e);
        }
    }

    public function testExigeUneSeuleContrepartieValide(): void
    {
        $this->assertThrows(InvalidRequest::class, fn () => $this->create());
        $this->assertThrows(InvalidRequest::class, fn () => $this->create(2, 10));
        $this->assertThrows(InvalidRequest::class, fn () => $this->create(1));
        foreach ([0, -5, 2_000_000] as $price) {
            $this->assertThrows(InvalidRequest::class, fn () => $this->create(price: $price));
        }
        // Expire 7 jours plus tard.
        self::assertFalse($this->create(price: 10)->isExpired($this->t0->modify('+7 days -1 second')));
        self::assertTrue($this->create(price: 10)->isExpired($this->t0->modify('+7 days')));
    }

    public function testNeSAccepteQuUneFoisParUnAutreJoueurAvantExpiration(): void
    {
        $this->assertThrows(InvalidRequest::class, fn () => $this->create(price: 10)->accept('s', $this->t0));
        $this->assertThrows(RuleViolation::class, fn () => $this->create(price: 10)->accept('b', $this->t0->modify('+8 days')));
        $o = $this->create(price: 10);
        $o->accept('b', $this->t0);
        $this->assertThrows(RuleViolation::class, fn () => $o->accept('c', $this->t0));
        $this->assertThrows(RuleViolation::class, fn () => $o->cancel('s', $this->t0));
    }

    public function testSeulLeVendeurRetireSonOffre(): void
    {
        $this->assertThrows(Forbidden::class, fn () => $this->create(price: 10)->cancel('b', $this->t0));
        $o = $this->create(price: 10);
        $o->cancel('s', $this->t0);
        $this->assertThrows(RuleViolation::class, fn () => $o->accept('b', $this->t0));
    }
}
