import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Clock, EventBus, PlayerLocks, UnitOfWork } from '../../../shared/application/ports';
import { NotFound, RuleViolation } from '../../../shared/domain/errors';
import { economyConfig } from '../../../config';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { CardsService } from '../../collection/application/cards.service';
import { WalletService } from '../../wallet/application/wallet.service';
import { TradeCompleted } from '../domain/events';
import { MarketCounters, TradeOfferRepository } from '../domain/ports';
import { TradeOffer } from '../domain/trade-offer';
import { tradeRules } from './market.config';

/**
 * Bourse d'échanges. Verrous : l'offre d'abord, puis les joueurs (triés) — même ordre partout.
 */
@Injectable()
export class TradesService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly trades: TradeOfferRepository,
    private readonly counters: MarketCounters,
    private readonly wallet: WalletService,
    private readonly cards: CardsService,
    private readonly catalog: CatalogReader,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  create(sellerId: string, input: { offeredCarId: number; wantedCarId?: number; price?: number }) {
    return this.uow.run(async () => {
      const offer = TradeOffer.create({ id: randomUUID(), sellerId, ...input, now: this.clock.now(), rules: tradeRules });
      await this.locks.lock(sellerId);
      const open = await this.trades.countOpenBySeller(sellerId);
      if (open >= economyConfig.maxOpenTrades) {
        throw new RuleViolation(`Vous avez déjà ${open} offres ouvertes (maximum ${economyConfig.maxOpenTrades})`);
      }
      if (offer.wantedCarId != null && !(await this.catalog.exists(offer.wantedCarId))) throw new NotFound('Carte demandée introuvable');
      // Séquestre : la carte quitte la collection tant que l'offre est ouverte.
      await this.cards.take(sellerId, offer.offeredCarId);
      await this.trades.create(offer);
      return { id: offer.id };
    });
  }

  accept(buyerId: string, id: string) {
    return this.uow.run(async () => {
      const offer = await this.trades.getForUpdate(id);
      offer.accept(buyerId, this.clock.now());
      await this.locks.lock(buyerId, offer.sellerId);
      if (offer.wantedCarId != null) {
        await this.cards.take(buyerId, offer.wantedCarId);
        await this.cards.grant(offer.sellerId, offer.wantedCarId);
      } else {
        await this.wallet.debit(buyerId, offer.price!, 'trade:purchase', offer.id);
        await this.wallet.credit(offer.sellerId, offer.price!, 'trade:sale', offer.id);
      }
      const card = await this.cards.grant(buyerId, offer.offeredCarId);
      await this.trades.save(offer);
      await this.counters.add(buyerId, { tradesCompleted: 1 });
      await this.counters.add(offer.sellerId, { tradesCompleted: 1 });
      await this.events.publish(new TradeCompleted(offer.id, offer.sellerId, buyerId, offer.offeredCarId));
      return { tradeId: offer.id, carId: offer.offeredCarId, ...card, balance: await this.wallet.balance(buyerId) };
    });
  }

  cancel(userId: string, id: string) {
    return this.uow.run(async () => {
      const offer = await this.trades.getForUpdate(id);
      offer.cancel(userId, this.clock.now());
      await this.release(offer);
      return { ok: true };
    });
  }

  /** Clôt les offres expirées et rend les cartes sous séquestre (tâche de fond). */
  async expireDue() {
    const ids = await this.trades.expiredIds(this.clock.now(), 200);
    let done = 0;
    for (const id of ids) {
      await this.uow
        .run(async () => {
          const offer = await this.trades.getForUpdate(id);
          offer.expire(this.clock.now());
          await this.release(offer);
          done++;
        })
        .catch(() => undefined); // Déjà acceptée ou annulée entre-temps.
    }
    return done;
  }

  private async release(offer: TradeOffer) {
    await this.locks.lock(offer.sellerId);
    await this.cards.grant(offer.sellerId, offer.offeredCarId);
    await this.trades.save(offer);
  }
}
