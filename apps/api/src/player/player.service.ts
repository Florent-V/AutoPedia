import { Injectable } from '@nestjs/common';
import { Player, Prisma, PrismaClient } from '@prisma/client';
import { economyConfig, gameConfig } from '../config';
import { BoosterStatus, computeBoosters } from '../game/booster-clock';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.guard';
import { computePlayerStats } from './player-stats';

type Db = PrismaClient | Prisma.TransactionClient;

export function boosterView(status: BoosterStatus, now = new Date()) {
  return {
    available: status.boosters,
    max: status.max,
    regenMs: status.regenMs,
    nextAt: status.nextAt?.toISOString() ?? null,
    serverTime: now.toISOString(),
  };
}

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(db: Db, userId: string): Promise<Player> {
    return db.player.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        boosters: Math.min(gameConfig.startingBoosters, gameConfig.boosterMax),
        // Crédits de bienvenue (non comptés dans « crédits gagnés » pour les succès).
        credits: economyConfig.startingCredits,
      },
    });
  }

  status(player: Player, now = new Date()): BoosterStatus {
    return computeBoosters(
      { boosters: player.boosters, anchor: player.boosterAnchor },
      now,
      gameConfig.boosterMax,
      gameConfig.boosterRegenMs,
    );
  }

  async me(user: AuthUser) {
    const player = await this.ensure(this.prisma, user.id);
    const [stats, totalCards, unlocked] = await Promise.all([
      computePlayerStats(this.prisma, user.id),
      this.prisma.car.count({ where: { active: true } }),
      this.prisma.userAchievement.count({ where: { userId: user.id } }),
    ]);
    return {
      user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
      boosters: boosterView(this.status(player)),
      stats: { ...stats, catalogSize: totalCards, achievements: unlocked },
      game: { cardsPerBooster: gameConfig.cardsPerBooster },
      pity: {
        epicIn: Math.max(1, economyConfig.pityEpic - player.sinceEpic),
        legendaryIn: Math.max(1, economyConfig.pityLegendary - player.sinceLegendary),
      },
    };
  }
}
