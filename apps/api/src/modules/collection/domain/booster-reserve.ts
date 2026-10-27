import { RuleViolation } from '../../../shared/domain/errors';
import { positiveInt } from '../../../shared/domain/guards';
import { Rarity } from '../../catalog/domain/rarity';
import { BoosterStatus, computeBoosters, consumeBooster } from './booster-clock';
import { Pity, pityFor } from './booster-draw';

export interface BoosterRules {
  max: number;
  regenMs: number;
  cardsPerBooster: number;
  pityEpic: number;
  pityLegendary: number;
}

export interface BoosterReserveSnapshot {
  userId: string;
  boosters: number;
  anchor: Date;
  boostersOpened: number;
  cardsObtained: number;
  sinceEpic: number;
  sinceLegendary: number;
}

/**
 * Réserve de boosters d'un joueur : régénération dans le temps, ouverture, garanties Épique / Légendaire.
 * Le nombre de boosters n'est jamais fourni par le client : il est recalculé à partir de l'ancre et de l'heure.
 */
export class BoosterReserve {
  private constructor(private state: BoosterReserveSnapshot) {}

  static restore(snapshot: BoosterReserveSnapshot) {
    return new BoosterReserve({ ...snapshot });
  }

  get userId() {
    return this.state.userId;
  }

  snapshot(): BoosterReserveSnapshot {
    return { ...this.state };
  }

  status(now: Date, rules: BoosterRules): BoosterStatus {
    return computeBoosters({ boosters: this.state.boosters, anchor: this.state.anchor }, now, rules.max, rules.regenMs);
  }

  /** Garantie applicable au prochain booster. */
  pity(rules: BoosterRules): Pity {
    return pityFor(this.state.sinceEpic, this.state.sinceLegendary, rules.pityEpic, rules.pityLegendary);
  }

  /** Retire un booster de la réserve (après régénération) ; 409 si elle est vide. */
  consume(now: Date, rules: BoosterRules): BoosterStatus {
    const status = this.status(now, rules);
    if (status.boosters <= 0) throw new RuleViolation('Aucun booster disponible pour le moment');
    const after = consumeBooster(status, now);
    this.state.boosters = after.boosters;
    this.state.anchor = after.anchor;
    return after;
  }

  /** Enregistre le contenu d'un booster ouvert : compteurs et remise à zéro des garanties obtenues. */
  recordOpening(rarities: Rarity[]) {
    const legendary = rarities.includes('LEGENDARY');
    const epic = legendary || rarities.includes('EPIC');
    this.state.boostersOpened += 1;
    this.state.cardsObtained += rarities.length;
    this.state.sinceEpic = epic ? 0 : this.state.sinceEpic + 1;
    this.state.sinceLegendary = legendary ? 0 : this.state.sinceLegendary + 1;
  }

  /** Offre des boosters (récompenses) : la réserve peut alors dépasser le maximum. */
  grant(count: number, now: Date, rules: BoosterRules): BoosterStatus {
    positiveInt(count, 'Nombre de boosters', 100);
    const status = this.status(now, rules);
    this.state.boosters = status.boosters + count;
    this.state.anchor = status.anchor;
    return this.status(now, rules);
  }
}

export abstract class BoosterReserveRepository {
  /** Charge la réserve (le joueur doit être verrouillé pour une modification). */
  abstract get(userId: string): Promise<BoosterReserve>;
  abstract save(reserve: BoosterReserve): Promise<void>;
  abstract recordOpening(userId: string, carIds: number[]): Promise<void>;
}
