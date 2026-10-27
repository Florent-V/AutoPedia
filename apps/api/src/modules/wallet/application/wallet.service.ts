import { Injectable } from '@nestjs/common';
import { LedgerReason, WalletRepository } from '../domain/wallet';

/**
 * Point d'entrée des autres contextes pour les crédits. À appeler dans une unité de travail,
 * après avoir verrouillé les joueurs concernés (`PlayerLocks`).
 */
@Injectable()
export class WalletService {
  constructor(private readonly wallets: WalletRepository) {}

  async balance(userId: string) {
    return (await this.wallets.get(userId)).balance;
  }

  /** Verse des crédits ; renvoie le nouveau solde. */
  async credit(userId: string, amount: number, reason: LedgerReason, ref?: string) {
    const wallet = await this.wallets.get(userId);
    wallet.credit(amount, reason, ref);
    await this.wallets.save(wallet);
    return wallet.balance;
  }

  /** Prélève des crédits (409 si le solde ne suffit pas) ; renvoie le nouveau solde. */
  async debit(userId: string, amount: number, reason: LedgerReason, ref?: string) {
    const wallet = await this.wallets.get(userId);
    wallet.debit(amount, reason, ref);
    await this.wallets.save(wallet);
    return wallet.balance;
  }
}
