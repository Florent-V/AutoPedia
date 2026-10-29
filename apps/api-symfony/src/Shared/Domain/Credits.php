<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use App\Shared\Domain\Exception\RuleViolation;

/** Un solde de crédits : entier, jamais négatif, plafonné. Immuable. */
final readonly class Credits
{
    /** Plafond d'un solde : aucune action légitime n'en approche. */
    public const MAX_BALANCE = 1_000_000_000;

    private function __construct(public int $value)
    {
    }

    public static function of(int $value): self
    {
        return new self(Guard::nonNegativeInt($value, 'Montant de crédits', self::MAX_BALANCE));
    }

    public function add(int $amount): self
    {
        Guard::positiveInt($amount, 'Montant de crédits', self::MAX_BALANCE);
        if ($this->value + $amount > self::MAX_BALANCE) {
            throw new RuleViolation('Solde maximal atteint');
        }

        return new self($this->value + $amount);
    }

    public function subtract(int $amount): self
    {
        Guard::positiveInt($amount, 'Montant de crédits', self::MAX_BALANCE);
        if ($amount > $this->value) {
            throw new RuleViolation("Crédits insuffisants ({$this->value} disponibles, $amount nécessaires)");
        }

        return new self($this->value - $amount);
    }
}
