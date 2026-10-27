import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

const LABELS: Record<string, string> = {
  'game:duel': 'Duel de stats',
  'game:quiz': 'Quiz auto',
  shop: 'Achat en boutique',
  'trade:sale': 'Vente à la bourse',
  'trade:purchase': 'Achat à la bourse',
  'auction:bid': 'Offre aux enchères (crédits bloqués)',
  'auction:refund': 'Enchère dépassée (remboursement)',
  'auction:sale': 'Vente aux enchères',
  achievement: 'Succès débloqué',
  daily: 'Récompense du jour',
  'bot:jeux': 'Mini-jeux',
  'bot:dotation': 'Dotation de départ',
};

/** Lecture : solde et derniers mouvements. */
@Injectable()
export class WalletHistoryQuery {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string, take = 30) {
    const [player, history] = await Promise.all([
      this.prisma.player.findUnique({ where: { userId }, select: { credits: true, creditsEarned: true } }),
      this.prisma.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take }),
    ]);
    return {
      balance: player?.credits ?? 0,
      earned: player?.creditsEarned ?? 0,
      history: history.map((h) => ({ ...h, label: LABELS[h.reason] ?? h.reason })),
    };
  }
}
