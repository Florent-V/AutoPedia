import { Injectable } from '@nestjs/common';
import { AfterCommit } from '../../../shared/infrastructure/events';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { AuctionOutbid, AuctionSettled, TradeCompleted } from '../../marketplace/domain/events';
import { PushService } from './push.service';

/** Notifications envoyées après validation des transactions (jamais pour une action annulée). */
@Injectable()
export class NotificationHandlers {
  constructor(
    private readonly push: PushService,
    private readonly catalog: CatalogReader,
  ) {}

  private async carName(carId: number) {
    return (await this.catalog.view(carId))?.name ?? 'Votre carte';
  }

  @AfterCommit(TradeCompleted)
  async onTradeCompleted(e: TradeCompleted) {
    await this.push.sendToUser(e.sellerId, {
      title: 'Échange conclu 🤝',
      body: `Votre « ${await this.carName(e.offeredCarId)} » a trouvé preneur à la bourse.`,
      url: '/market?tab=trades',
      tag: `trade-${e.tradeId}`,
    });
  }

  @AfterCommit(AuctionOutbid)
  async onOutbid(e: AuctionOutbid) {
    await this.push.sendToUser(e.outbidUserId, {
      title: 'Vous avez été surenchéri ⚠️',
      body: `« ${await this.carName(e.carId)} » : nouvelle offre à ${e.newBid} crédits. Vos crédits vous ont été rendus.`,
      url: '/market?tab=auctions',
      tag: `auction-${e.auctionId}`,
    });
  }

  @AfterCommit(AuctionSettled)
  async onSettled(e: AuctionSettled) {
    if (!e.sold || !e.buyerId) return;
    const name = await this.carName(e.carId);
    await this.push.sendToUser(e.buyerId, {
      title: 'Enchère remportée 🔨',
      body: `« ${name} » rejoint votre garage pour ${e.price} crédits.`,
      url: '/collection',
      tag: `auction-${e.auctionId}`,
    });
    await this.push.sendToUser(e.sellerId, {
      title: 'Vente aux enchères conclue 💰',
      body: `« ${name} » est parti pour ${e.price} crédits.`,
      url: '/market?tab=auctions',
      tag: `auction-${e.auctionId}`,
    });
  }
}
