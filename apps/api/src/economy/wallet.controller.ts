import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const REASONS: Record<string, string> = {
  'game:duel': 'Duel de stats',
  'game:quiz': 'Quiz auto',
  shop: 'Achat en boutique',
  'trade:sale': 'Vente à la bourse',
  'trade:purchase': 'Achat à la bourse',
};

@Controller('wallet')
export class WalletController {
  constructor(private readonly prisma: PrismaService) {}

  /** Solde et 30 derniers mouvements de crédits. */
  @Get()
  async wallet(@CurrentUser() user: AuthUser) {
    const [player, history] = await Promise.all([
      this.prisma.player.findUnique({ where: { userId: user.id }, select: { credits: true, creditsEarned: true } }),
      this.prisma.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return {
      balance: player?.credits ?? 0,
      earned: player?.creditsEarned ?? 0,
      history: history.map((h) => ({ ...h, label: REASONS[h.reason] ?? h.reason })),
    };
  }
}
