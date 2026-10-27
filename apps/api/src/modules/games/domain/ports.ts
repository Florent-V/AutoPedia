import { GameType } from './game-rules';
import { GameSession } from './game-session';
import { Round } from './rounds';

/** Fabrique de manches (questions tirées du catalogue). */
export abstract class QuestionFactory {
  /** Une manche du jeu, sans réutiliser les cartes `used` ; null si le catalogue ne le permet pas. */
  abstract make(type: GameType, used: number[]): Promise<Round | null>;
}

export abstract class GameSessionRepository {
  abstract findActive(userId: string, type: GameType): Promise<GameSession | null>;
  /** Partie du joueur, verrouillée pour la réponse ; null si elle n'existe pas ou appartient à un autre joueur. */
  abstract getForUpdate(id: string, userId: string): Promise<GameSession | null>;
  abstract find(id: string, userId: string): Promise<GameSession | null>;
  abstract bestScore(userId: string, type: GameType): Promise<number>;
  abstract countStartedSince(userId: string, type: GameType, since: Date): Promise<number>;
  abstract create(session: GameSession): Promise<void>;
  abstract save(session: GameSession): Promise<void>;
  /** Compteurs du joueur liés aux jeux (statistiques et succès). */
  abstract addPlayerCounters(userId: string, counters: { gamesPlayed?: number; gameCardsWon?: number; doorsJackpots?: number }): Promise<void>;
}
