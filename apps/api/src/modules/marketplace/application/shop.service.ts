import { Injectable } from '@nestjs/common';
import { Clock, EventBus, PlayerLocks, UnitOfWork } from '../../../shared/application/ports';
import { NotFound, RuleViolation } from '../../../shared/domain/errors';
import { zonedParts } from '../../../shared/domain/zoned-time';
import { economyConfig } from '../../../config';
import { CardsService } from '../../collection/application/cards.service';
import { WalletService } from '../../wallet/application/wallet.service';
import { ShopCardPurchased } from '../domain/events';
import { MarketCounters, ShopCatalog, ShopPurchaseRepository } from '../domain/ports';
import { offersAt } from '../domain/shop-rotation';
import { SHOP_SECRET } from './market.config';

@Injectable()
export class ShopService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly catalog: ShopCatalog,
    private readonly purchases: ShopPurchaseRepository,
    private readonly counters: MarketCounters,
    private readonly wallet: WalletService,
    private readonly cards: CardsService,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  /** Offres de l'heure, recalculées par le serveur (programme déterministe à graine secrète). */
  async currentOffers(now = this.clock.now()) {
    const z = zonedParts(now, economyConfig.timezone);
    return { date: z.date, hour: z.hour, offers: offersAt(await this.catalog.idsByRarity(), SHOP_SECRET, z.date, z.hour) };
  }

  /** Achat d'une offre de l'heure : le client n'envoie que la clé de l'offre ; carte et prix viennent du serveur. */
  buy(userId: string, offerKey: string) {
    return this.uow.run(async () => {
      await this.locks.lock(userId);
      const { offers } = await this.currentOffers();
      const offer = offers.find((o) => o.offerKey === offerKey);
      if (!offer) throw new NotFound('Cette offre n’est plus disponible (la boutique a tourné)');
      if (await this.purchases.exists(userId, offerKey)) throw new RuleViolation('Vous avez déjà acheté cette offre');

      const purchaseId = await this.purchases.create({ userId, offerKey, carId: offer.carId, price: offer.price });
      const balance = await this.wallet.debit(userId, offer.price, 'shop', purchaseId);
      const card = await this.cards.grant(userId, offer.carId);
      await this.counters.add(userId, { shopPurchases: 1 });
      await this.events.publish(new ShopCardPurchased(userId, offer.carId, offer.price));
      return { carId: offer.carId, ...card, balance };
    });
  }
}
