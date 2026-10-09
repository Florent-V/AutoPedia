function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const gameConfig = {
  boosterRegenMs: int('BOOSTER_REGEN_MINUTES', 30) * 60_000,
  boosterMax: int('BOOSTER_MAX', 10),
  cardsPerBooster: int('CARDS_PER_BOOSTER', 5),
  /** Boosters offerts à l'inscription. */
  startingBoosters: int('BOOSTER_START', int('BOOSTER_MAX', 10)),
};

export type GameConfig = typeof gameConfig;
