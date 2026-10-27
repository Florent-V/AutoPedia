import { Credits } from '../../../shared/domain/credits';

/** Motif d'un mouvement de crédits (journal). */
export type LedgerReason =
  | 'game:duel'
  | 'game:quiz'
  | 'shop'
  | 'trade:sale'
  | 'trade:purchase'
  | 'auction:bid'
  | 'auction:refund'
  | 'auction:sale'
  | 'achievement'
  | 'daily'
  | 'bot:jeux'
  | 'bot:dotation';

export interface LedgerEntry {
  amount: number;
  reason: LedgerReason;
  ref?: string;
  /** Solde après le mouvement. */
  balance: number;
}

/**
 * Portefeuille d'un joueur. Seul point de modification du solde : chaque mouvement est
 * contrôlé (montant entier positif, solde jamais négatif) et inscrit au journal.
 */
export class Wallet {
  private readonly pending: LedgerEntry[] = [];

  /** Solde au chargement : la sauvegarde vérifie qu'il n'a pas changé entre-temps. */
  readonly loadedBalance: number;

  private constructor(
    readonly userId: string,
    private balanceValue: Credits,
    private earnedValue: number,
  ) {
    this.loadedBalance = balanceValue.value;
  }

  static restore(userId: string, balance: number, earned: number) {
    return new Wallet(userId, Credits.of(balance), earned);
  }

  get balance() {
    return this.balanceValue.value;
  }

  /** Total des crédits gagnés (hors crédits de bienvenue), pour les succès. */
  get earned() {
    return this.earnedValue;
  }

  canAfford(amount: number) {
    return this.balanceValue.covers(amount);
  }

  credit(amount: number, reason: LedgerReason, ref?: string) {
    this.balanceValue = this.balanceValue.add(amount);
    this.earnedValue += amount;
    this.pending.push({ amount, reason, ref, balance: this.balance });
  }

  debit(amount: number, reason: LedgerReason, ref?: string) {
    this.balanceValue = this.balanceValue.subtract(amount);
    this.pending.push({ amount: -amount, reason, ref, balance: this.balance });
  }

  /** Mouvements à enregistrer depuis le chargement. */
  pullEntries(): LedgerEntry[] {
    return this.pending.splice(0);
  }
}

export abstract class WalletRepository {
  /** Charge le portefeuille (le joueur doit être verrouillé). */
  abstract get(userId: string): Promise<Wallet>;
  abstract save(wallet: Wallet): Promise<void>;
}
