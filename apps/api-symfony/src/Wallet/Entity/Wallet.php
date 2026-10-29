<?php

declare(strict_types=1);

namespace App\Wallet\Entity;

use App\Shared\Domain\Credits;
use App\Wallet\Domain\LedgerEntry;
use App\Wallet\Domain\LedgerReason;
use Doctrine\ORM\Mapping as ORM;

/**
 * Portefeuille d'un joueur (colonnes credits / creditsEarned de « player », embarquées dans Player).
 * Seul point de modification du solde : chaque mouvement est contrôlé (entier positif, solde jamais négatif)
 * et mis en attente pour le journal.
 */
#[ORM\Embeddable]
class Wallet
{
    #[ORM\Column]
    private int $credits;

    #[ORM\Column]
    private int $creditsEarned = 0;

    /** @var list<LedgerEntry> mouvements pas encore inscrits au journal (non persisté) */
    private array $pending = [];

    public function __construct(int $credits)
    {
        $this->credits = Credits::of($credits)->value;
    }

    public function balance(): int
    {
        return $this->credits;
    }

    /** Total des crédits gagnés (hors crédits de bienvenue), pour les succès. */
    public function earned(): int
    {
        return $this->creditsEarned;
    }

    public function credit(int $amount, LedgerReason $reason, ?string $ref = null): void
    {
        $this->credits = Credits::of($this->credits)->add($amount)->value;
        $this->creditsEarned += $amount;
        $this->pending[] = new LedgerEntry($amount, $reason, $ref, $this->credits);
    }

    public function debit(int $amount, LedgerReason $reason, ?string $ref = null): void
    {
        $this->credits = Credits::of($this->credits)->subtract($amount)->value;
        $this->pending[] = new LedgerEntry(-$amount, $reason, $ref, $this->credits);
    }

    /** @return list<LedgerEntry> */
    public function pullEntries(): array
    {
        $entries = $this->pending;
        $this->pending = [];

        return $entries;
    }
}
