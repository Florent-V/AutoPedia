<?php

declare(strict_types=1);

namespace App\Tests\Unit\Wallet;

use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use App\Wallet\Domain\LedgerEntry;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Entity\Wallet;
use PHPUnit\Framework\TestCase;

final class WalletTest extends TestCase
{
    public function testJournaliseChaqueMouvementAvecLeSoldeResultant(): void
    {
        $w = new Wallet(100);
        $w->credit(50, LedgerReason::DAILY);
        $w->debit(30, LedgerReason::SHOP, 'achat-1');
        self::assertSame(120, $w->balance());
        self::assertSame(50, $w->earned());
        self::assertEquals([
            new LedgerEntry(50, LedgerReason::DAILY, null, 150),
            new LedgerEntry(-30, LedgerReason::SHOP, 'achat-1', 120),
        ], $w->pullEntries());
        self::assertSame([], $w->pullEntries());
    }

    public function testRefuseUnDebitSuperieurAuSoldeSansRienModifier(): void
    {
        $w = new Wallet(10);
        try {
            $w->debit(11, LedgerReason::SHOP);
            self::fail('RuleViolation attendue');
        } catch (RuleViolation) {
        }
        self::assertSame(10, $w->balance());
        self::assertSame([], $w->pullEntries());
    }

    public function testRefuseLesMontantsNulsOuNegatifs(): void
    {
        $w = new Wallet(10);
        foreach ([0, -5] as $amount) {
            foreach ([fn () => $w->credit($amount, LedgerReason::DAILY), fn () => $w->debit($amount, LedgerReason::SHOP)] as $op) {
                try {
                    $op();
                    self::fail('InvalidRequest attendue');
                } catch (InvalidRequest) {
                    $this->addToAssertionCount(1);
                }
            }
        }
    }
}
