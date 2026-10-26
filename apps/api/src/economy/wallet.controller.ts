import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { PlayerService } from '../player/player.service';
import { PrismaService } from '../prisma/prisma.service';

const REASONS: Record<string, string> = {
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
};

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
  ) {}

  /** Solde et 30 derniers mouvements de crédits. */
  @Get()
  async wallet(@CurrentUser() user: AuthUser) {
    // Crée la fiche joueur si besoin (sinon un nouveau joueur verrait un solde de 0 au lieu des crédits de bienvenue).
    await this.players.ensure(this.prisma, user.id);
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
