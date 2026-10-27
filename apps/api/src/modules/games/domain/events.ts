import { DomainEvent } from '../../../shared/domain/domain-event';

/** Une manche a été jouée (crédits ou carte gagnés, partie éventuellement terminée). */
export class GameRoundPlayed implements DomainEvent {
  static readonly eventName = 'games.round-played';
  readonly eventName = GameRoundPlayed.eventName;

  constructor(
    readonly userId: string,
    readonly sessionId: string,
    readonly finished: boolean,
  ) {}
}
