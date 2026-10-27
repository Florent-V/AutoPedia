import { Injectable } from '@nestjs/common';
import { Clock, PlayerLocks, RandomSource, UnitOfWork } from '../../../shared/application/ports';
import { startOfZonedDay, zonedParts } from '../../../shared/domain/zoned-time';
import { economyConfig } from '../../../config';
import { BoostersService } from '../../collection/application/boosters.service';
import { CardsService } from '../../collection/application/cards.service';
import { WalletService } from '../../wallet/application/wallet.service';
import { DAILY_REWARDS, DailyStreakRepository } from '../domain/daily-streak';
import { AchievementsService } from './achievements.service';

@Injectable()
export class DailyRewardService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly streaks: DailyStreakRepository,
    private readonly wallet: WalletService,
    private readonly boosters: BoostersService,
    private readonly cards: CardsService,
    private readonly achievements: AchievementsService,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  /** Jours « aujourd'hui » et « hier » dans le fuseau du jeu, d'après l'horloge du serveur. */
  private dates(now: Date) {
    const tz = economyConfig.timezone;
    const start = startOfZonedDay(now, tz);
    return {
      today: zonedParts(now, tz).date,
      yesterday: zonedParts(new Date(start.getTime() - 1), tz).date,
      resetsAt: startOfZonedDay(new Date(start.getTime() + 26 * 3600 * 1000), tz),
    };
  }

  async status(userId: string) {
    const { today, yesterday, resetsAt } = this.dates(this.clock.now());
    const s = (await this.streaks.get(userId)).status(today, yesterday);
    return { canClaim: s.canClaim, streak: s.streak, bestStreak: s.best, day: s.day, resetsAt: resetsAt.toISOString(), rewards: DAILY_REWARDS };
  }

  claim(userId: string) {
    return this.uow.run(async () => {
      await this.locks.lock(userId);
      const { today, yesterday } = this.dates(this.clock.now());
      const streak = await this.streaks.get(userId);
      const reward = streak.claim(today, yesterday);
      await this.streaks.save(streak);

      // Boosters offerts : ils s'ajoutent à la réserve, au-delà du maximum si besoin.
      const boosters = reward.boosters ? await this.boosters.grant(userId, reward.boosters) : await this.boosters.status(userId);
      if (reward.credits) await this.wallet.credit(userId, reward.credits, 'daily', `jour-${reward.day}`);
      let card: { carId: number; quantity: number; isNew: boolean } | null = null;
      if (reward.topCard) {
        const car = await this.cards.draw(this.random.next() < 0.2 ? 'LEGENDARY' : 'EPIC');
        card = { carId: car.id, ...(await this.cards.grant(userId, car.id)) };
      }
      await this.achievements.evaluate(userId);
      const s = streak.snapshot();
      return { day: reward.day, streak: s.streak, reward, card, balance: await this.wallet.balance(userId), boosters };
    });
  }
}
