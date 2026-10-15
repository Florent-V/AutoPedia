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

/** Économie : crédits, mini-jeux, boutique, bourse. */
export const economyConfig = {
  /** Fuseau horaire des journées de jeu et des rotations de la boutique. */
  timezone: process.env.GAME_TIMEZONE ?? 'Europe/Paris',
  startingCredits: int('STARTING_CREDITS', 100),
  /** Parties par jour et par mini-jeu. */
  gamesPerDay: int('GAMES_PER_DAY', 3),
  duelRounds: 10,
  duelCreditsPerWin: 10,
  quizQuestions: 5,
  quizCreditsPerWin: 15,
  /** Durée de vie d'une offre de la bourse (jours) et nombre maximal d'offres ouvertes par joueur. */
  tradeDays: int('TRADE_DAYS', 7),
  maxOpenTrades: int('MAX_OPEN_TRADES', 10),
  /** Garanties : un booster sur N contient au moins une Épique / une Légendaire. */
  pityEpic: int('PITY_EPIC', 10),
  pityLegendary: int('PITY_LEGENDARY', 60),
};
