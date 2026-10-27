/**
 * Erreurs métier. Le domaine ne connaît pas HTTP : c'est le filtre `DomainErrorFilter`
 * qui traduit chaque type en code de réponse. Les messages sont en français, prêts à afficher.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: 'invalid' | 'not-found' | 'forbidden' | 'conflict' | 'unavailable';

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Demande incohérente avec les règles (400). */
export class InvalidRequest extends DomainError {
  readonly kind = 'invalid' as const;
}

/** Objet inexistant, ou qui n'appartient pas au joueur (404). */
export class NotFound extends DomainError {
  readonly kind = 'not-found' as const;
}

/** Action réservée à quelqu'un d'autre (403). */
export class Forbidden extends DomainError {
  readonly kind = 'forbidden' as const;
}

/** Règle du jeu qui s'oppose à l'action dans l'état actuel : solde, réserve vide, déjà fait… (409). */
export class RuleViolation extends DomainError {
  readonly kind = 'conflict' as const;
}

/** Service momentanément impossible, par exemple catalogue vide (503). */
export class Unavailable extends DomainError {
  readonly kind = 'unavailable' as const;
}
