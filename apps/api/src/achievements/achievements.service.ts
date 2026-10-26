import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computePlayerStats, PlayerStats } from '../player/player-stats';
import { moveCredits } from '../economy/wallet';
import { ACHIEVEMENTS, AchievementDef, TIER_REWARD } from './achievements.definitions';

export type UnlockedAchievement = AchievementDef & { reward: number };

type Db = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Débloque les succès atteints, verse leur récompense en crédits et renvoie ceux nouvellement obtenus.
   * La récompense n'est versée que si l'insertion a vraiment eu lieu (ON CONFLICT DO NOTHING RETURNING) :
   * deux évaluations simultanées ne peuvent pas payer deux fois le même succès.
   */
  async evaluate(db: Db, userId: string, stats?: PlayerStats): Promise<UnlockedAchievement[]> {
    const current = stats ?? (await computePlayerStats(db, userId));
    const unlocked = await db.userAchievement.findMany({ where: { userId }, select: { achievementId: true } });
    const done = new Set(unlocked.map((u) => u.achievementId));
    const candidates = ACHIEVEMENTS.filter((a) => !done.has(a.id) && current[a.stat] >= a.goal);
    const fresh: UnlockedAchievement[] = [];
    for (const a of candidates) {
      const inserted = await db.$queryRaw<Array<{ achievementId: string }>>`
        INSERT INTO "user_achievement" ("userId", "achievementId", "unlockedAt")
        VALUES (${userId}, ${a.id}, now())
        ON CONFLICT DO NOTHING
        RETURNING "achievementId"`;
      if (!inserted.length) continue;
      const reward = TIER_REWARD[a.tier];
      await moveCredits(db as Prisma.TransactionClient, userId, reward, 'achievement', a.id);
      fresh.push({ ...a, reward });
    }
    return fresh;
  }

  async list(userId: string) {
    const stats = await computePlayerStats(this.prisma, userId);
    await this.evaluate(this.prisma, userId, stats);
    const unlocked = await this.prisma.userAchievement.findMany({ where: { userId } });
    const byId = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
    return {
      unlocked: unlocked.length,
      total: ACHIEVEMENTS.length,
      achievements: ACHIEVEMENTS.map((a) => ({
        ...a,
        reward: TIER_REWARD[a.tier],
        progress: Math.min(stats[a.stat], a.goal),
        unlockedAt: byId.get(a.id) ?? null,
      })),
    };
  }
}
