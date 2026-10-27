import { DomainEvent } from '../../../shared/domain/domain-event';

export class ShopCardPurchased implements DomainEvent {
  static readonly eventName = 'marketplace.shop-card-purchased';
  readonly eventName = ShopCardPurchased.eventName;
  constructor(
    readonly userId: string,
    readonly carId: number,
    readonly price: number,
  ) {}
}

export class TradeCompleted implements DomainEvent {
  static readonly eventName = 'marketplace.trade-completed';
  readonly eventName = TradeCompleted.eventName;
  constructor(
    readonly tradeId: string,
    readonly sellerId: string,
    readonly buyerId: string,
    readonly offeredCarId: number,
  ) {}
}

/** Un joueur a été surenchéri (ses crédits lui ont été rendus). */
export class AuctionOutbid implements DomainEvent {
  static readonly eventName = 'marketplace.auction-outbid';
  readonly eventName = AuctionOutbid.eventName;
  constructor(
    readonly auctionId: string,
    readonly outbidUserId: string,
    readonly carId: number,
    readonly newBid: number,
  ) {}
}

export class AuctionSettled implements DomainEvent {
  static readonly eventName = 'marketplace.auction-settled';
  readonly eventName = AuctionSettled.eventName;
  constructor(
    readonly auctionId: string,
    readonly sold: boolean,
    readonly sellerId: string,
    readonly buyerId: string | null,
    readonly carId: number,
    readonly price: number | null,
  ) {}
}
