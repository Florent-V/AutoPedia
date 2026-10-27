import { InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { Wallet } from './wallet';

describe('Wallet', () => {
  it('journalise chaque mouvement avec le solde résultant', () => {
    const w = Wallet.restore('u', 100, 0);
    w.credit(50, 'daily');
    w.debit(30, 'shop', 'achat-1');
    expect(w.balance).toBe(120);
    expect(w.earned).toBe(50);
    expect(w.pullEntries()).toEqual([
      { amount: 50, reason: 'daily', ref: undefined, balance: 150 },
      { amount: -30, reason: 'shop', ref: 'achat-1', balance: 120 },
    ]);
    expect(w.pullEntries()).toEqual([]);
  });

  it('refuse un débit supérieur au solde sans rien modifier', () => {
    const w = Wallet.restore('u', 10, 0);
    expect(() => w.debit(11, 'shop')).toThrow(RuleViolation);
    expect(w.balance).toBe(10);
    expect(w.pullEntries()).toEqual([]);
  });

  it('refuse les montants nuls, négatifs ou décimaux', () => {
    const w = Wallet.restore('u', 10, 0);
    for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => w.credit(amount, 'daily')).toThrow(InvalidRequest);
      expect(() => w.debit(amount, 'shop')).toThrow(InvalidRequest);
    }
  });
});
