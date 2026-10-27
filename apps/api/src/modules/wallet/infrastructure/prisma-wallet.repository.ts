import { Injectable } from '@nestjs/common';
import { NotFound } from '../../../shared/domain/errors';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { Wallet, WalletRepository } from '../domain/wallet';

@Injectable()
export class PrismaWalletRepository extends WalletRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async get(userId: string) {
    const row = await this.db.tx.player.findUnique({ where: { userId }, select: { credits: true, creditsEarned: true } });
    if (!row) throw new NotFound('Joueur introuvable');
    return Wallet.restore(userId, row.credits, row.creditsEarned);
  }

  async save(wallet: Wallet) {
    const entries = wallet.pullEntries();
    if (!entries.length) return;
    // Concurrence optimiste (en plus du verrou joueur) : jamais de mise à jour perdue sur un solde.
    const updated = await this.db.tx.player.updateMany({
      where: { userId: wallet.userId, credits: wallet.loadedBalance },
      data: { credits: wallet.balance, creditsEarned: wallet.earned },
    });
    if (updated.count !== 1) throw new Error(`Solde modifié pendant l'opération (joueur ${wallet.userId}) : opération annulée`);
    await this.db.tx.creditTransaction.createMany({
      data: entries.map((e) => ({ userId: wallet.userId, amount: e.amount, reason: e.reason, ref: e.ref, balance: e.balance })),
    });
  }
}
