import { DomainEvent } from '../../../shared/domain/domain-event';

/** Un joueur a ouvert un booster. */
export class BoosterOpened implements DomainEvent {
  static readonly eventName = 'collection.booster-opened';
  readonly eventName = BoosterOpened.eventName;

  constructor(
    readonly userId: string,
    readonly carIds: number[],
  ) {}
}
