<?php

declare(strict_types=1);

namespace App\Tests\Unit\Marketplace;

use App\Marketplace\Entity\Auction;
use App\Shared\Domain\Exception\DomainException;
use App\Shared\Domain\Exception\Forbidden;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use PHPUnit\Framework\TestCase;

final class AuctionTest extends TestCase
{
    private const DURATIONS = [1, 3, 6, 12, 24];
    private const SNIPE = 120;
    private \DateTimeImmutable $t0;

    protected function setUp(): void
    {
        $this->t0 = new \DateTimeImmutable('2026-06-01T12:00:00Z');
    }

    private function at(int $seconds): \DateTimeImmutable
    {
        return $this->t0->modify("+$seconds seconds");
    }

    private function open(int $startPrice = 20): Auction
    {
        return new Auction('seller', 1, $startPrice, 1, self::DURATIONS, $this->t0);
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

    public function testValideLaMiseEnVente(): void
    {
        $this->assertThrows(InvalidRequest::class, fn () => new Auction('s', 1, 5, 2, self::DURATIONS, $this->t0));
        foreach ([0, -3, 2_000_000] as $startPrice) {
            $this->assertThrows(InvalidRequest::class, fn () => $this->open($startPrice));
        }
    }

    public function testImposeLOffreMinimaleEtRendLaMainAuPrecedentEncherisseur(): void
    {
        $a = $this->open();
        $this->assertThrows(InvalidRequest::class, fn () => $a->bid('seller', 50, $this->at(1), self::SNIPE));
        $this->assertThrows(InvalidRequest::class, fn () => $a->bid('b1', 19, $this->at(1), self::SNIPE));
        self::assertNull($a->bid('b1', 20, $this->at(1), self::SNIPE));
        $this->assertThrows(RuleViolation::class, fn () => $a->bid('b1', 40, $this->at(2), self::SNIPE));
        self::assertSame(21, $a->minBid());
        $this->assertThrows(InvalidRequest::class, fn () => $a->bid('b2', 20, $this->at(2), self::SNIPE));
        self::assertSame(['userId' => 'b1', 'amount' => 20], $a->bid('b2', 21, $this->at(2), self::SNIPE));
        foreach ([0, -1, 20_000_000] as $amount) {
            $this->assertThrows(InvalidRequest::class, fn () => $a->bid('b3', $amount, $this->at(3), self::SNIPE));
        }
    }

    public function testProlongeUneEnchereQuiRecoitUneOffreDansLesDeuxDernieresMinutes(): void
    {
        $a = $this->open();
        $a->bid('b1', 20, $this->at(3600 - 30), self::SNIPE);
        self::assertEquals($this->at(3600 - 30 + 120), $a->endsAt());
        $this->assertThrows(RuleViolation::class, fn () => $a->bid('b2', 30, $this->at(3600 + 200), self::SNIPE));
    }

    public function testNeSAnnuleQueParLeVendeurSansOffre(): void
    {
        $this->assertThrows(Forbidden::class, fn () => $this->open()->cancel('autre', $this->t0));
        $a = $this->open();
        $a->bid('b1', 20, $this->at(1), self::SNIPE);
        $this->assertThrows(RuleViolation::class, fn () => $a->cancel('seller', $this->at(2)));
    }

    public function testSeRegleALEcheanceCommissionRetenueSurLePrix(): void
    {
        $a = $this->open();
        $a->bid('b1', 25, $this->at(10), self::SNIPE);
        $this->assertThrows(RuleViolation::class, fn () => $a->settle($this->at(100), 5));
        self::assertSame(
            ['sold' => true, 'sellerId' => 'seller', 'buyerId' => 'b1', 'carId' => 1, 'price' => 25, 'fee' => 1, 'sellerProceeds' => 24],
            $a->settle($this->at(3600), 5),
        );
        $this->assertThrows(RuleViolation::class, fn () => $a->settle($this->at(3601), 5));
        self::assertFalse($this->open()->settle($this->at(3600), 5)['sold']);
    }
}
