import { DomainEvent } from '../domain/domain-event';

/**
 * Exécute un travail dans une transaction. Les appels imbriqués rejoignent la transaction en cours.
 * Les événements publiés pendant le travail sont traités :
 *  - immédiatement par les abonnés « dans la transaction » (une erreur annule tout) ;
 *  - après validation par les abonnés « après validation » (notifications…).
 */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}

export abstract class EventBus {
  abstract publish(...events: DomainEvent[]): Promise<void>;
}

/** Horloge injectable (tests déterministes). */
export abstract class Clock {
  abstract now(): Date;
}

/** Source d'aléatoire injectable : nombre dans [0, 1[. */
export abstract class RandomSource {
  abstract next(): number;
}

/**
 * Verrou par joueur (ligne « player », `FOR UPDATE`) : toute action qui modifie l'état d'un joueur le prend d'abord,
 * dans la transaction en cours. Plusieurs joueurs sont toujours verrouillés dans le même ordre (pas d'interblocage).
 */
export abstract class PlayerLocks {
  abstract lock(...userIds: string[]): Promise<void>;
}
