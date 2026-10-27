import { InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { Choice, GameDef, GameType, isValidChoice } from './game-rules';
import { carsUsedBy, judge, Judgement, publicQuestion, Round } from './rounds';

export interface GameSessionSnapshot {
  id: string;
  userId: string;
  type: GameType;
  status: 'ACTIVE' | 'FINISHED';
  round: number;
  score: number;
  credits: number;
  createdAt: Date;
  finishedAt: Date | null;
  rewardCarId: number | null;
  state: { used: number[]; current: Round | null; history: Array<{ correct: boolean }> };
}

export interface AnswerOutcome extends Judgement {
  /** Manche jouée (pour révéler la réponse). */
  round: Round;
  /** Crédits gagnés par cette réponse. */
  gained: number;
  /** La partie doit-elle continuer (manche suivante à fournir) ? */
  continues: boolean;
}

/** Partie de mini-jeu. Seul le serveur connaît la réponse ; le client n'envoie que son choix. */
export class GameSession {
  private constructor(
    private s: GameSessionSnapshot,
    private readonly def: GameDef,
  ) {}

  static start(params: { id: string; userId: string; type: GameType; def: GameDef; first: Round; now: Date }) {
    return new GameSession(
      {
        id: params.id,
        userId: params.userId,
        type: params.type,
        status: 'ACTIVE',
        round: 1,
        score: 0,
        credits: 0,
        createdAt: params.now,
        finishedAt: null,
        rewardCarId: null,
        state: { used: carsUsedBy(params.first), current: params.first, history: [] },
      },
      params.def,
    );
  }

  static restore(snapshot: GameSessionSnapshot, def: GameDef) {
    return new GameSession(structuredClone(snapshot), def);
  }

  get id() {
    return this.s.id;
  }

  get type() {
    return this.s.type;
  }

  get finished() {
    return this.s.status === 'FINISHED';
  }

  get usedCars() {
    return [...this.s.state.used];
  }

  /** Sans-faute sur un jeu qui l'autorise : carte bonus. */
  get earnedPerfectBonus() {
    return this.finished && this.def.perfectBonus && this.s.score >= this.def.rounds;
  }

  snapshot(): GameSessionSnapshot {
    return structuredClone(this.s);
  }

  isStale(now: Date, maxAgeMs: number) {
    return now.getTime() - this.s.createdAt.getTime() >= maxAgeMs;
  }

  /** Juge la réponse à la manche en cours. */
  answer(choice: unknown): AnswerOutcome {
    if (this.finished) throw new RuleViolation('Cette partie est terminée');
    const round = this.s.state.current;
    if (!round) throw new RuleViolation('Aucune question en cours');
    if (!isValidChoice(this.def, choice)) throw new InvalidRequest('Réponse invalide');

    const judgement = judge(round, choice as Choice, this.def.reward === 'card');
    const gained = judgement.correct ? this.def.creditsPerWin : 0;
    this.s.score += judgement.correct ? 1 : 0;
    this.s.credits += gained;
    this.s.state.history.push({ correct: judgement.correct });
    this.s.state.current = null;
    if (judgement.prizeCarId) this.s.rewardCarId = judgement.prizeCarId;
    const continues = this.s.round < this.def.rounds && !(this.def.endsOnMistake && !judgement.correct);
    return { ...judgement, round, gained, continues };
  }

  /** Passe à la manche suivante, ou termine la partie (`next` absent : plus de question possible). */
  continueWith(next: Round | null, now: Date) {
    if (!next) return this.finish(now);
    this.s.round += 1;
    this.s.state.current = next;
    this.s.state.used.push(...carsUsedBy(next));
  }

  finish(now: Date) {
    this.s.status = 'FINISHED';
    this.s.finishedAt = now;
    this.s.state.current = null;
  }

  setBonusCard(carId: number) {
    this.s.rewardCarId = carId;
  }

  /** Vue envoyée au client : la question en cours sans réponse ni contenu des portes. */
  view() {
    const current = this.s.status === 'ACTIVE' ? this.s.state.current : null;
    return {
      id: this.s.id,
      type: this.s.type,
      name: this.def.name,
      reward: this.def.reward,
      status: this.s.status,
      round: this.s.round,
      total: this.def.rounds,
      score: this.s.score,
      credits: this.s.credits,
      creditsPerWin: this.def.creditsPerWin,
      history: this.s.state.history,
      question: current ? publicQuestion(current) : null,
    };
  }
}
