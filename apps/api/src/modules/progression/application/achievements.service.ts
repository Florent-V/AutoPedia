import { Injectable } from '@nestjs/common';
import { PlayerLocks, UnitOfWork } from '../../../shared/application/ports';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { WalletService } from '../../wallet/application/wallet.service';
import { ACHIEVEMENTS, reachedAchievements, TIER_REWARD } from '../domain/achievements';
import { AchievementUnlocks, UnlockedAchievement } from './achievement-unlocks';
import { PlayerStatsQuery } from '../../statistics/player-stats.query';

@Injectable()
export class AchievementsService {
  constructor(
    private readonly db: Db,
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly wallet: WalletService,
    private readonly unlocks: AchievementUnlocks,
    private readonly stats: PlayerStatsQuery,
  ) {}

  /**
   * Débloque les succès atteints et verse leur récompense, dans la transaction en cours.
   * La récompense n'est versée que si l'insertion a vraiment eu lieu (ON CONFLICT DO NOTHING RETURNING) :
   * deux évaluations simultanées ne peuvent pas payer deux fois le même succès.
   */
  evaluate(userId: string): Promise<UnlockedAchievement[]> {
    return this.uow.run(async () => {
      await this.locks.lock(userId);
      const tx = this.db.tx;
      const stats = await this.stats.forUser(userId);
      const unlocked = await tx.userAchievement.findMany({ where: { userId }, select: { achievementId: true } });
      const fresh: UnlockedAchievement[] = [];
      for (const a of reachedAchievements(stats, unlocked.map((u) => u.achievementId))) {
        const inserted = await tx.$queryRaw<Array<{ achievementId: string }>>`
          INSERT INTO "user_achievement" ("userId", "achievementId", "unlockedAt")
          VALUES (${userId}, ${a.id}, now())
          ON CONFLICT DO NOTHING
          RETURNING "achievementId"`;
        if (!inserted.length) continue;
        const reward = TIER_REWARD[a.tier];
        await this.wallet.credit(userId, reward, 'achievement', a.id);
        fresh.push({ ...a, reward });
      }
      this.unlocks.record(userId, fresh);
      return fresh;
    });
  }

  async list(userId: string) {
    // Rattrapage : un succès atteint mais pas encore enregistré est débloqué (et payé) à l'affichage.
    await this.evaluate(userId);
    const stats = await this.stats.forUser(userId);
    const unlocked = await this.db.tx.userAchievement.findMany({ where: { userId } });
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

  count(userId: string) {
    return this.db.tx.userAchievement.count({ where: { userId } });
  }
}
