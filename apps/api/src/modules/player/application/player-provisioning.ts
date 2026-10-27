import { Injectable } from '@nestjs/common';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { economyConfig, gameConfig } from '../../../config';

/**
 * Crée la fiche « player » d'un compte (réserve de départ, crédits de bienvenue), une seule fois.
 * Appelé avant chaque requête authentifiée : les cas d'usage peuvent compter sur son existence.
 */
@Injectable()
export class PlayerProvisioning {
  /** Comptes dont la fiche existe déjà (évite une requête à chaque appel). */
  private readonly known = new Set<string>();

  constructor(private readonly db: Db) {}

  async ensure(userId: string) {
    if (this.known.has(userId)) return;
    await this.db.tx.player.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        boosters: Math.min(gameConfig.startingBoosters, gameConfig.boosterMax),
        // Crédits de bienvenue (non comptés dans « crédits gagnés » pour les succès).
        credits: economyConfig.startingCredits,
      },
    });
    if (this.known.size > 100_000) this.known.clear();
    this.known.add(userId);
  }
}
