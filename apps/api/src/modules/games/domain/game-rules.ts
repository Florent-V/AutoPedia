/** Règles des mini-jeux (pures). */

export const GAME_TYPES = ['DUEL', 'QUIZ', 'WEIGHT', 'MYSTERY', 'DOORS'] as const;
export type GameType = (typeof GAME_TYPES)[number];

export interface GameDef {
  name: string;
  description: string;
  rounds: number;
  /** Crédits par bonne réponse (jeux à crédits). */
  creditsPerWin: number;
  /** Parties par jour. */
  playsPerDay: number;
  /** « credits » : on gagne des crédits ; « card » : on remporte la carte en jeu. */
  reward: 'credits' | 'card';
  /** La partie s'arrête à la première erreur. */
  endsOnMistake: boolean;
  /** Carte bonus pour un sans-faute (jeux à crédits). */
  perfectBonus: boolean;
  /** Réponses acceptées. */
  choices: 'ab' | 3 | 4;
}

export interface GamesConfig {
  duelRounds: number;
  duelCreditsPerWin: number;
  quizQuestions: number;
  quizCreditsPerWin: number;
  gamesPerDay: number;
  quickGamesPerDay: number;
  doorsPerDay: number;
}

export function defineGames(c: GamesConfig): Record<GameType, GameDef> {
  return {
    DUEL: {
      name: 'Duel de stats',
      description:
        'Deux voitures, une question : laquelle est la plus rapide, la plus lourde, la plus ancienne… La partie s’arrête à la première erreur.',
      rounds: c.duelRounds,
      creditsPerWin: c.duelCreditsPerWin,
      playsPerDay: c.gamesPerDay,
      reward: 'credits',
      endsOnMistake: true,
      perfectBonus: true,
      choices: 'ab',
    },
    QUIZ: {
      name: 'Quiz auto',
      description: 'Cinq questions à 4 choix : marque, pays, décennie ou modèle en photo. Chaque bonne réponse rapporte des crédits.',
      rounds: c.quizQuestions,
      creditsPerWin: c.quizCreditsPerWin,
      playsPerDay: c.gamesPerDay,
      reward: 'credits',
      endsOnMistake: false,
      perfectBonus: true,
      choices: 4,
    },
    WEIGHT: {
      name: 'Poids lourds',
      description: 'Deux voitures s’affrontent sur la balance. Désignez la plus lourde et elle rejoint votre garage !',
      rounds: 1,
      creditsPerWin: 0,
      playsPerDay: c.quickGamesPerDay,
      reward: 'card',
      endsOnMistake: true,
      perfectBonus: false,
      choices: 'ab',
    },
    MYSTERY: {
      name: 'Question pour une carte',
      description: 'Une carte, une question, quatre réponses. Plus la carte est rare, plus la question est pointue. Bonne réponse = carte gagnée.',
      rounds: 1,
      creditsPerWin: 0,
      playsPerDay: c.quickGamesPerDay,
      reward: 'card',
      endsOnMistake: true,
      perfectBonus: false,
      choices: 4,
    },
    DOORS: {
      name: 'Les 3 garages',
      description: 'Trois portes fermées : un garage vide, une carte standard et une carte Épique ou Légendaire. À vous de choisir !',
      rounds: 1,
      creditsPerWin: 0,
      playsPerDay: c.doorsPerDay,
      reward: 'card',
      endsOnMistake: true,
      perfectBonus: false,
      choices: 3,
    },
  };
}

export type Choice = 'a' | 'b' | number;

/** La réponse a la forme attendue par ce jeu (« a »/« b », ou un indice entier dans les bornes). */
export function isValidChoice(def: GameDef, choice: unknown): choice is Choice {
  if (def.choices === 'ab') return choice === 'a' || choice === 'b';
  return Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) < def.choices;
}
