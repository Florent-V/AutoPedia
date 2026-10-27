import { Injectable } from '@nestjs/common';
import { Clock, EventBus, PlayerLocks, RandomSource, UnitOfWork } from '../../../shared/application/ports';
import { rollBoosterRarities } from '../domain/booster-draw';
import { BoosterReserveRepository } from '../domain/booster-reserve';
import { BoosterOpened } from '../domain/events';
import { DrawnCar } from '../domain/ports';
import { boosterRules } from './booster-rules';
import { boosterView } from './booster-view';
import { CardsService } from './cards.service';

@Injectable()
export class BoostersService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly reserves: BoosterReserveRepository,
    private readonly cards: CardsService,
    private readonly events: EventBus,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  async status(userId: string) {
    const now = this.clock.now();
    return boosterView((await this.reserves.get(userId)).status(now, boosterRules), now);
  }

  /** Garanties à venir, pour l'affichage. */
  async pityCountdown(userId: string) {
    const s = (await this.reserves.get(userId)).snapshot();
    return {
      epicIn: Math.max(1, boosterRules.pityEpic - s.sinceEpic),
      legendaryIn: Math.max(1, boosterRules.pityLegendary - s.sinceLegendary),
    };
  }

  /** Ouvre un booster : tout est décidé ici (raretés, cartes, garanties), le client n'envoie rien. */
  open(userId: string) {
    return this.uow.run(async () => {
      await this.locks.lock(userId);
      const now = this.clock.now();
      const reserve = await this.reserves.get(userId);
      const pity = reserve.pity(boosterRules);
      const after = reserve.consume(now, boosterRules);

      const drawn: DrawnCar[] = [];
      for (const rarity of rollBoosterRarities(boosterRules.cardsPerBooster, () => this.random.next(), pity)) {
        // Pas de doublon au sein d'un même booster.
        drawn.push(await this.cards.draw(rarity, drawn.map((c) => c.id)));
      }
      reserve.recordOpening(drawn.map((c) => c.rarity));
      await this.reserves.save(reserve);

      const cards = [];
      for (const car of drawn) cards.push({ carId: car.id, ...(await this.cards.grant(userId, car.id)) });
      await this.reserves.recordOpening(userId, drawn.map((c) => c.id));
      await this.events.publish(new BoosterOpened(userId, drawn.map((c) => c.id)));

      return { cards, boosters: boosterView(after, now), pity: { epic: !!pity.epic, legendary: !!pity.legendary } };
    });
  }

  /** Offre des boosters (récompense quotidienne) ; la réserve peut dépasser le maximum. Joueur verrouillé. */
  async grant(userId: string, count: number) {
    const now = this.clock.now();
    const reserve = await this.reserves.get(userId);
    const status = reserve.grant(count, now, boosterRules);
    await this.reserves.save(reserve);
    return boosterView(status, now);
  }
}
