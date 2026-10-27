import { Injectable } from '@nestjs/common';
import { NotFound } from '../../../shared/domain/errors';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { DailyStreak, DailyStreakRepository } from '../domain/daily-streak';

@Injectable()
export class PrismaDailyStreakRepository extends DailyStreakRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async get(userId: string) {
    const p = await this.db.tx.player.findUnique({ where: { userId }, select: { dailyStreak: true, bestStreak: true, lastDailyClaim: true } });
    if (!p) throw new NotFound('Joueur introuvable');
    return DailyStreak.restore({ userId, streak: p.dailyStreak, best: p.bestStreak, lastClaim: p.lastDailyClaim });
  }

  async save(streak: DailyStreak) {
    const s = streak.snapshot();
    await this.db.tx.player.update({
      where: { userId: s.userId },
      data: { dailyStreak: s.streak, bestStreak: s.best, lastDailyClaim: s.lastClaim },
    });
  }
}
