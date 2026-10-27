import { ConflictException, Injectable } from '@nestjs/common';
import { Rarity } from '@prisma/client';
import { economyConfig } from '../config';
import { AchievementsService } from '../achievements/achievements.service';
import { BoostersService } from '../boosters/boosters.service';
import { toCardDto } from '../cars/card.dto';
import { addCard, lockPlayers, moveCredits } from '../economy/wallet';
import { startOfZonedDay, zonedParts } from '../game/zoned-time';
import { boosterView, PlayerService } from '../player/player.service';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';

export interface DailyReward {
  day: number;
  credits: number;
  boosters: number;
  /** Carte Épique (ou Légendaire, 1 fois sur 5). */
  topCard: boolean;
  label: string;
}

/** Cycle de 7 jours consécutifs ; il recommence au jour 1 après le 7e jour, ou après un jour manqué. */
export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, credits: 50, boosters: 0, topCard: false, label: '50 crédits' },
  { day: 2, credits: 0, boosters: 1, topCard: false, label: '1 booster' },
  { day: 3, credits: 100, boosters: 0, topCard: false, label: '100 crédits' },
  { day: 4, credits: 0, boosters: 2, topCard: false, label: '2 boosters' },
  { day: 5, credits: 150, boosters: 0, topCard: false, label: '150 crédits' },
  { day: 6, credits: 0, boosters: 3, topCard: false, label: '3 boosters' },
  { day: 7, credits: 200, boosters: 0, topCard: true, label: '200 crédits + 1 carte Épique' },
];

@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly boosters: BoostersService,
    private readonly achievements: AchievementsService,
  ) {}

  private dates(now = new Date()) {
    const tz = economyConfig.timezone;
    const start = startOfZonedDay(now, tz);
    return {
      today: zonedParts(now, tz).date,
      yesterday: zonedParts(new Date(start.getTime() - 1), tz).date,
      resetsAt: startOfZonedDay(new Date(start.getTime() + 26 * 3600 * 1000), tz),
    };
  }

  async status(userId: string) {
    const player = await this.players.ensure(this.prisma, userId);
    const { today, yesterday, resetsAt } = this.dates();
    const claimedToday = player.lastDailyClaim === today;
    const alive = claimedToday || player.lastDailyClaim === yesterday;
    const streak = alive ? player.dailyStreak : 0;
    return {
      canClaim: !claimedToday,
      streak,
      bestStreak: player.bestStreak,
      /** Jour du cycle qui sera (ou a été) réclamé aujourd'hui. */
      day: claimedToday ? ((streak - 1) % 7) + 1 : (streak % 7) + 1,
      resetsAt: resetsAt.toISOString(),
      rewards: DAILY_REWARDS,
    };
  }

  async claim(userId: string) {
    await this.players.ensure(this.prisma, userId);
    return this.prisma.$transaction(
      async (tx) => {
        await lockPlayers(tx, userId);
        const player = await tx.player.findUniqueOrThrow({ where: { userId } });
        const now = new Date();
        const { today, yesterday } = this.dates(now);
        if (player.lastDailyClaim === today) throw new ConflictException('Récompense du jour déjà réclamée : revenez demain !');

        const streak = player.lastDailyClaim === yesterday ? player.dailyStreak + 1 : 1;
        const reward = DAILY_REWARDS[(streak - 1) % 7];

        // Boosters offerts : ils s'ajoutent à la réserve, au-delà du maximum si besoin.
        let boosterState = this.players.status(player, now);
        if (reward.boosters) {
          const anchor = boosterState.nextAt ? boosterState.anchor : now;
          await tx.player.update({ where: { userId }, data: { boosters: boosterState.boosters + reward.boosters, boosterAnchor: anchor } });
          boosterState = this.players.status({ ...player, boosters: boosterState.boosters + reward.boosters, boosterAnchor: anchor }, now);
        }
        if (reward.credits) await moveCredits(tx, userId, reward.credits, 'daily', `jour-${reward.day}`);

        let card = null;
        if (reward.topCard) {
          const rarity: Rarity = Math.random() < 0.2 ? 'LEGENDARY' : 'EPIC';
          const car = await this.boosters.pickCar(tx, rarity, []);
          if (car) {
            const { quantity, isNew } = await addCard(tx, userId, car.id, now);
            card = { ...toCardDto(car), quantity, isNew };
          }
        }

        await tx.player.update({
          where: { userId },
          data: { dailyStreak: streak, bestStreak: Math.max(player.bestStreak, streak), lastDailyClaim: today },
        });
        const newAchievements = await this.achievements.evaluate(tx, userId);
        const balance = (await tx.player.findUniqueOrThrow({ where: { userId }, select: { credits: true } })).credits;
        return { day: reward.day, streak, reward, card, balance, boosters: boosterView(boosterState, now), newAchievements };
      },
      { timeout: 15_000 },
    );
  }
}
