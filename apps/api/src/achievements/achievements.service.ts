import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computePlayerStats, PlayerStats } from '../player/player-stats';
import { ACHIEVEMENTS, AchievementDef } from './achievements.definitions';

type Db = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Débloque les succès atteints et renvoie ceux nouvellement obtenus. */
  async evaluate(db: Db, userId: string, stats?: PlayerStats): Promise<AchievementDef[]> {
    const current = stats ?? (await computePlayerStats(db, userId));
    const unlocked = await db.userAchievement.findMany({ where: { userId }, select: { achievementId: true } });
    const done = new Set(unlocked.map((u) => u.achievementId));
    const fresh = ACHIEVEMENTS.filter((a) => !done.has(a.id) && current[a.stat] >= a.goal);
    if (fresh.length) {
      await db.userAchievement.createMany({
        data: fresh.map((a) => ({ userId, achievementId: a.id })),
        skipDuplicates: true,
      });
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
        progress: Math.min(stats[a.stat], a.goal),
        unlockedAt: byId.get(a.id) ?? null,
      })),
    };
  }
}
