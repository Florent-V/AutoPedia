import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventClass } from '../domain/domain-event';

/** Préfixe des abonnements exécutés après validation de la transaction. */
export const AFTER_COMMIT = 'after-commit:';

/**
 * Abonné exécuté dans la transaction du cas d'usage qui publie l'événement :
 * ses écritures sont atomiques avec celles du cas d'usage, et une erreur annule tout.
 */
export const OnDomainEvent = (event: DomainEventClass) =>
  OnEvent(event.eventName, { async: false, promisify: true, suppressErrors: false });

/**
 * Abonné exécuté après validation (effets externes : notifications push…).
 * Une erreur est journalisée sans affecter la requête.
 */
export const AfterCommit = (event: DomainEventClass) =>
  OnEvent(AFTER_COMMIT + event.eventName, { async: true, promisify: true, suppressErrors: true });
