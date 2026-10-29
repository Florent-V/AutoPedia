<?php

declare(strict_types=1);

namespace App\Wallet\Domain;

/** Mouvement de crédits en attente d'enregistrement au journal. */
final readonly class LedgerEntry
{
    public function __construct(
        public int $amount,
        public LedgerReason $reason,
        public ?string $ref,
        /** Solde après le mouvement. */
        public int $balance,
    ) {
    }
}
