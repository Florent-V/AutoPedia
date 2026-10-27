import { Injectable } from '@nestjs/common';
import { Auction as AuctionRow, TradeOffer as TradeRow } from '@prisma/client';
import { NotFound } from '../../../shared/domain/errors';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { Auction } from '../domain/auction';
import { AuctionRepository, MarketCounters, ShopCatalog, ShopPurchaseRepository, TradeOfferRepository } from '../domain/ports';
import { TradeOffer } from '../domain/trade-offer';

const tradeToDomain = (r: TradeRow) =>
  TradeOffer.restore({
    id: r.id,
    sellerId: r.sellerId,
    offeredCarId: r.offeredCarId,
    wantedCarId: r.wantedCarId,
    price: r.price,
    status: r.status,
    buyerId: r.buyerId,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    closedAt: r.closedAt,
  });

@Injectable()
export class PrismaTradeOfferRepository extends TradeOfferRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async getForUpdate(id: string) {
    await this.db.tx.$queryRaw`SELECT 1 FROM "trade_offer" WHERE "id" = ${id} FOR UPDATE`;
    const row = await this.db.tx.tradeOffer.findUnique({ where: { id } });
    if (!row) throw new NotFound('Offre introuvable');
    return tradeToDomain(row);
  }

  async create(offer: TradeOffer) {
    const s = offer.snapshot();
    await this.db.tx.tradeOffer.create({
      data: { id: s.id, sellerId: s.sellerId, offeredCarId: s.offeredCarId, wantedCarId: s.wantedCarId, price: s.price, createdAt: s.createdAt, expiresAt: s.expiresAt },
    });
  }

  async save(offer: TradeOffer) {
    const s = offer.snapshot();
    await this.db.tx.tradeOffer.update({ where: { id: s.id }, data: { status: s.status, buyerId: s.buyerId, closedAt: s.closedAt } });
  }

  countOpenBySeller(sellerId: string) {
    return this.db.tx.tradeOffer.count({ where: { sellerId, status: 'OPEN' } });
  }

  async expiredIds(now: Date, limit: number) {
    const rows = await this.db.tx.tradeOffer.findMany({ where: { status: 'OPEN', expiresAt: { lte: now } }, select: { id: true }, take: limit });
    return rows.map((r) => r.id);
  }
}

const auctionToDomain = (r: AuctionRow) =>
  Auction.restore({
    id: r.id,
    sellerId: r.sellerId,
    carId: r.carId,
    startPrice: r.startPrice,
    currentBid: r.currentBid,
    bidderId: r.bidderId,
    bidCount: r.bidCount,
    status: r.status,
    createdAt: r.createdAt,
    endsAt: r.endsAt,
    closedAt: r.closedAt,
  });

@Injectable()
export class PrismaAuctionRepository extends AuctionRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async getForUpdate(id: string) {
    await this.db.tx.$queryRaw`SELECT 1 FROM "auction" WHERE "id" = ${id} FOR UPDATE`;
    const row = await this.db.tx.auction.findUnique({ where: { id } });
    if (!row) throw new NotFound('Enchère introuvable');
    return auctionToDomain(row);
  }

  async create(auction: Auction) {
    const s = auction.snapshot();
    await this.db.tx.auction.create({
      data: { id: s.id, sellerId: s.sellerId, carId: s.carId, startPrice: s.startPrice, createdAt: s.createdAt, endsAt: s.endsAt },
    });
  }

  async save(auction: Auction) {
    const s = auction.snapshot();
    await this.db.tx.auction.update({
      where: { id: s.id },
      data: { currentBid: s.currentBid, bidderId: s.bidderId, bidCount: s.bidCount, status: s.status, endsAt: s.endsAt, closedAt: s.closedAt },
    });
  }

  async recordBid(auctionId: string, userId: string, amount: number) {
    await this.db.tx.bid.create({ data: { auctionId, userId, amount } });
  }

  countOpenBySeller(sellerId: string) {
    return this.db.tx.auction.count({ where: { sellerId, status: 'OPEN' } });
  }

  async dueIds(now: Date, limit: number) {
    const rows = await this.db.tx.auction.findMany({ where: { status: 'OPEN', endsAt: { lte: now } }, select: { id: true }, take: limit });
    return rows.map((r) => r.id);
  }
}

@Injectable()
export class PrismaShopPurchaseRepository extends ShopPurchaseRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async exists(userId: string, offerKey: string) {
    return (await this.db.tx.shopPurchase.count({ where: { userId, offerKey } })) > 0;
  }

  async create(p: { userId: string; offerKey: string; carId: number; price: number }) {
    return (await this.db.tx.shopPurchase.create({ data: p, select: { id: true } })).id;
  }
}

@Injectable()
export class CatalogShopCatalog extends ShopCatalog {
  constructor(private readonly catalog: CatalogReader) {
    super();
  }

  idsByRarity() {
    return this.catalog.activeIdsByRarity();
  }
}

@Injectable()
export class PrismaMarketCounters extends MarketCounters {
  constructor(private readonly db: Db) {
    super();
  }

  async add(userId: string, c: { shopPurchases?: number; tradesCompleted?: number; auctionsWon?: number; auctionsSold?: number }) {
    await this.db.tx.player.update({
      where: { userId },
      data: {
        shopPurchases: { increment: c.shopPurchases ?? 0 },
        tradesCompleted: { increment: c.tradesCompleted ?? 0 },
        auctionsWon: { increment: c.auctionsWon ?? 0 },
        auctionsSold: { increment: c.auctionsSold ?? 0 },
      },
    });
  }
}
