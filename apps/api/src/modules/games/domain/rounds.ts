import { Rarity } from '../../catalog/domain/rarity';
import { Choice } from './game-rules';

/** Carte montrée pendant un jeu : jamais les valeurs qui donneraient la réponse. */
export interface GameCard {
  id: number;
  name: string;
  manufacturer: string | null;
  imageUrl: string | null;
  rarity: Rarity;
}

export type DuelStatKey = 'topSpeedKmh' | 'massKg' | 'lengthMm' | 'powerKw' | 'yearStart' | 'popularity';

export interface DuelRound {
  kind?: undefined;
  stat: DuelStatKey;
  question: string;
  a: GameCard;
  b: GameCard;
  answer: 'a' | 'b';
  reveal: { a: string; b: string };
  /** Poids lourds : carte gagnée (la plus lourde). */
  prizeCarId?: number;
}

export interface QuizRound {
  kind: 'brand' | 'country' | 'decade' | 'photo';
  prompt: string;
  car: { name: string | null; imageUrl: string | null };
  choices: string[];
  answer: number;
  carId: number;
}

export interface MysteryRound {
  kind: 'country' | 'decade' | 'year';
  prompt: string;
  card: GameCard;
  choices: string[];
  answer: number;
  carId: number;
  prizeCarId: number;
}

/** Contenu d'une porte des « 3 garages ». */
export interface Door {
  tier: 'none' | 'standard' | 'top';
  carId: number | null;
}

export interface DoorsRound {
  kind: 'doors';
  prompt: string;
  doors: number;
  outcomes: Door[];
}

export type Round = DuelRound | QuizRound | MysteryRound | DoorsRound;

/** Champs secrets d'une manche : ils restent sur le serveur jusqu'à la réponse. */
const SECRET_KEYS = ['answer', 'reveal', 'carId', 'prizeCarId', 'outcomes'] as const;

/** Question telle qu'envoyée au client, sans aucun champ secret. */
export function publicQuestion(round: Round): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...round };
  for (const key of SECRET_KEYS) delete copy[key];
  return copy;
}

export interface Judgement {
  correct: boolean;
  /** Carte gagnée par cette réponse (jeux à carte). */
  prizeCarId: number | null;
  /** Porte Épique / Légendaire trouvée. */
  jackpot: boolean;
}

export function judge(round: Round, choice: Choice, rewardsCard: boolean): Judgement {
  if (round.kind === 'doors') {
    const door = round.outcomes[choice as number];
    return { correct: door.tier !== 'none', prizeCarId: door.carId, jackpot: door.tier === 'top' };
  }
  const correct = choice === round.answer;
  const prize = 'prizeCarId' in round ? (round.prizeCarId ?? null) : null;
  return { correct, prizeCarId: correct && rewardsCard ? prize : null, jackpot: false };
}

/** Cartes utilisées par une manche (pour ne pas les reproposer dans la même partie). */
export function carsUsedBy(round: Round): number[] {
  if (round.kind === 'doors') return [];
  if ('carId' in round) return [round.carId];
  return [round.a.id, round.b.id];
}
