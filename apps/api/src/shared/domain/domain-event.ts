/** Fait métier accompli, publié par un cas d'usage et écouté par les autres contextes. */
export interface DomainEvent {
  /** Nom stable de l'événement (« contexte.fait »). */
  readonly eventName: string;
}

/** Classe d'événement : porte son nom en statique pour l'abonnement. */
export interface DomainEventClass<E extends DomainEvent = DomainEvent> {
  readonly eventName: string;
  new (...args: never[]): E;
}
