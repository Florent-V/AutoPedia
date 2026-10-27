import { RuleViolation } from '../../../shared/domain/errors';

export interface DailyReward {
  day: number;
  credits: number;
  boosters: number;
  /** Carte Épique (ou Légendaire, 1 fois sur 5). */
  topCard: boolean;
  label: string;
}

/** Cycle de 7 jours consécutifs ; il recommence au jour 1 après le 7e jour, ou après un jour manqué. */
export const DAILY_REWARDS: readonly DailyReward[] = [
  { day: 1, credits: 50, boosters: 0, topCard: false, label: '50 crédits' },
  { day: 2, credits: 0, boosters: 1, topCard: false, label: '1 booster' },
  { day: 3, credits: 100, boosters: 0, topCard: false, label: '100 crédits' },
  { day: 4, credits: 0, boosters: 2, topCard: false, label: '2 boosters' },
  { day: 5, credits: 150, boosters: 0, topCard: false, label: '150 crédits' },
  { day: 6, credits: 0, boosters: 3, topCard: false, label: '3 boosters' },
  { day: 7, credits: 200, boosters: 0, topCard: true, label: '200 crédits + 1 carte Épique' },
];

export interface DailyStreakSnapshot {
  userId: string;
  streak: number;
  best: number;
  /** Dernier jour réclamé (AAAA-MM-JJ dans le fuseau du jeu). */
  lastClaim: string | null;
}

/** Série de jours consécutifs de récompense quotidienne. Les dates viennent de l'horloge du serveur. */
export class DailyStreak {
  private constructor(private state: DailyStreakSnapshot) {}

  static restore(snapshot: DailyStreakSnapshot) {
    return new DailyStreak({ ...snapshot });
  }

  snapshot(): DailyStreakSnapshot {
    return { ...this.state };
  }

  status(today: string, yesterday: string) {
    const claimedToday = this.state.lastClaim === today;
    const alive = claimedToday || this.state.lastClaim === yesterday;
    const streak = alive ? this.state.streak : 0;
    return {
      canClaim: !claimedToday,
      streak,
      best: this.state.best,
      /** Jour du cycle qui sera (ou a été) réclamé aujourd'hui. */
      day: claimedToday ? ((streak - 1) % 7) + 1 : (streak % 7) + 1,
    };
  }

  /** Réclame la récompense du jour ; 409 si elle l'a déjà été. */
  claim(today: string, yesterday: string): DailyReward {
    if (this.state.lastClaim === today) throw new RuleViolation('Récompense du jour déjà réclamée : revenez demain !');
    const streak = this.state.lastClaim === yesterday ? this.state.streak + 1 : 1;
    this.state = { ...this.state, streak, best: Math.max(this.state.best, streak), lastClaim: today };
    return DAILY_REWARDS[(streak - 1) % 7];
  }
}

export abstract class DailyStreakRepository {
  abstract get(userId: string): Promise<DailyStreak>;
  abstract save(streak: DailyStreak): Promise<void>;
}
