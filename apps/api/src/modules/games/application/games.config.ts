import { economyConfig } from '../../../config';
import { defineGames } from '../domain/game-rules';

export const GAMES = defineGames(economyConfig);

/** Abandon automatique d'une partie restée ouverte. */
export const ABANDON_AFTER_MS = 60 * 60 * 1000;
