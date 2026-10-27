import { RuleViolation } from './errors';
import { nonNegativeInt, positiveInt } from './guards';

/** Plafond d'un solde : aucune action légitime n'en approche, et cela écarte tout dépassement d'entier en base. */
export const MAX_BALANCE = 1_000_000_000;

/** Un solde de crédits : entier, jamais négatif. Immuable. */
export class Credits {
  private constructor(readonly value: number) {}

  static of(value: number) {
    return new Credits(nonNegativeInt(value, 'Montant de crédits', MAX_BALANCE));
  }

  static zero() {
    return new Credits(0);
  }

  add(amount: number) {
    positiveInt(amount, 'Montant de crédits', MAX_BALANCE);
    if (this.value + amount > MAX_BALANCE) throw new RuleViolation('Solde maximal atteint');
    return new Credits(this.value + amount);
  }

  subtract(amount: number) {
    positiveInt(amount, 'Montant de crédits', MAX_BALANCE);
    if (amount > this.value) {
      throw new RuleViolation(`Crédits insuffisants (${this.value} disponibles, ${amount} nécessaires)`);
    }
    return new Credits(this.value - amount);
  }

  covers(amount: number) {
    return this.value >= amount;
  }
}
