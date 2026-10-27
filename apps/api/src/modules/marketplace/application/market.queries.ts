import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { nextZonedHour } from '../../../shared/domain/zoned-time';
import { economyConfig } from '../../../config';
import { toCardDto } from '../../catalog/application/card-view';
import { minBid } from '../domain/auction';
import { SHOP_RULES } from '../domain/shop-rotation';
import { ShopService } from './shop.service';

export interface MarketListQuery<Tab extends string> {
  tab: Tab;
  rarity?: string;
  search?: string;
  page: number;
}

const PAGE_SIZE = 24;

/** Lectures du marché (CQRS léger) : listes de la boutique, de la bourse et des enchères. */
@Injectable()
export class MarketQueries {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
  ) {}

  async shop(userId: string) {
    const player = await this.prisma.player.findUniqueOrThrow({ where: { userId } });
    const now = new Date();
    const { date, hour, offers } = await this.shopService.currentOffers(now);
    const [cars, purchases, owned] = await Promise.all([
      this.prisma.car.findMany({ where: { id: { in: offers.map((o) => o.carId) } } }),
      this.prisma.shopPurchase.findMany({ where: { userId, offerKey: { in: offers.map((o) => o.offerKey) } }, select: { offerKey: true } }),
      this.prisma.userCard.findMany({ where: { userId, carId: { in: offers.map((o) => o.carId) } } }),
    ]);
    const bought = new Set(purchases.map((p) => p.offerKey));
    const nextRotation = nextZonedHour(now, economyConfig.timezone);
    return {
      date,
      hour,
      balance: player.credits,
      nextRotationAt: nextRotation.toISOString(),
      rules: Object.fromEntries(Object.entries(SHOP_RULES).map(([r, v]) => [r, { price: v.price, everyHours: v.everyHours }])),
      offers: offers.map((o) => {
        const car = cars.find((c) => c.id === o.carId)!;
        // Fin de l'offre : début de l'heure « untilHour » du jour (calculé depuis la prochaine rotation).
        const endsAt = new Date(nextRotation.getTime() + (o.untilHour - hour - 1) * 3600 * 1000);
        return {
          offerKey: o.offerKey,
          price: o.price,
          basePrice: o.basePrice,
          deal: o.deal,
          endsAt: endsAt.toISOString(),
          purchased: bought.has(o.offerKey),
          card: { ...toCardDto(car), quantity: owned.find((u) => u.carId === car.id)?.quantity ?? 0 },
        };
      }),
    };
  }

  async trades(userId: string, q: MarketListQuery<'all' | 'mine' | 'forme'>) {
    const now = new Date();
    const where: Prisma.TradeOfferWhereInput = { status: 'OPEN', expiresAt: { gt: now } };
    const and: Prisma.TradeOfferWhereInput[] = [];
    if (q.tab === 'mine') and.push({ sellerId: userId });
    else and.push({ sellerId: { not: userId } });
    if (q.tab === 'forme') {
      // Offres intéressantes : la carte proposée me manque, et je peux payer ou je possède la carte demandée.
      const [owned, player] = await Promise.all([
        this.prisma.userCard.findMany({ where: { userId }, select: { carId: true } }),
        this.prisma.player.findUniqueOrThrow({ where: { userId } }),
      ]);
      const ownedIds = owned.map((o) => o.carId);
      and.push({ offeredCarId: { notIn: ownedIds } });
      and.push({ OR: [{ wantedCarId: { in: ownedIds } }, { price: { lte: player.credits } }] });
    }
    if (q.search) {
      and.push({
        OR: [
          { offeredCar: { name: { contains: q.search, mode: 'insensitive' } } },
          { offeredCar: { manufacturer: { contains: q.search, mode: 'insensitive' } } },
        ],
      });
    }
    if (q.rarity) {
      const r = q.rarity as Prisma.EnumRarityFilter['equals'];
      and.push({ offeredCar: { OR: [{ rarityOverride: r }, { rarityOverride: null, rarity: r }] } });
    }
    where.AND = and;

    const [total, offers, owned, player] = await Promise.all([
      this.prisma.tradeOffer.count({ where }),
      this.prisma.tradeOffer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { offeredCar: true, wantedCar: true, seller: { select: { name: true, player: { select: { isBot: true } } } } },
      }),
      this.prisma.userCard.findMany({ where: { userId }, select: { carId: true, quantity: true } }),
      this.prisma.player.findUniqueOrThrow({ where: { userId } }),
    ]);
    const qty = new Map(owned.map((o) => [o.carId, o.quantity]));
    return {
      page: q.page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
      balance: player.credits,
      openLimit: economyConfig.maxOpenTrades,
      offers: offers.map((o) => ({
        id: o.id,
        mine: o.sellerId === userId,
        seller: o.seller.name,
        sellerIsBot: o.seller.player?.isBot ?? false,
        createdAt: o.createdAt,
        expiresAt: o.expiresAt,
        price: o.price,
        offered: { ...toCardDto(o.offeredCar), quantity: qty.get(o.offeredCarId) ?? 0 },
        wanted: o.wantedCar ? { ...toCardDto(o.wantedCar), quantity: qty.get(o.wantedCarId!) ?? 0 } : null,
        canAccept:
          o.sellerId !== userId &&
          (o.wantedCarId != null ? (qty.get(o.wantedCarId) ?? 0) > 0 : player.credits >= (o.price ?? Infinity)),
      })),
    };
  }

  async auctions(userId: string, q: MarketListQuery<'all' | 'selling' | 'bidding'>) {
    const now = new Date();
    const where: Prisma.AuctionWhereInput = { status: 'OPEN', endsAt: { gt: now } };
    const and: Prisma.AuctionWhereInput[] = [];
    if (q.tab === 'selling') and.push({ sellerId: userId });
    if (q.tab === 'bidding') and.push({ bids: { some: { userId } } });
    if (q.search) {
      and.push({
        OR: [
          { car: { name: { contains: q.search, mode: 'insensitive' } } },
          { car: { manufacturer: { contains: q.search, mode: 'insensitive' } } },
        ],
      });
    }
    if (q.rarity) {
      const r = q.rarity as Prisma.EnumRarityFilter['equals'];
      and.push({ car: { OR: [{ rarityOverride: r }, { rarityOverride: null, rarity: r }] } });
    }
    where.AND = and;

    const userSelect = { select: { name: true, player: { select: { isBot: true } } } } as const;
    const [total, auctions, owned, player] = await Promise.all([
      this.prisma.auction.count({ where }),
      this.prisma.auction.findMany({
        where,
        orderBy: { endsAt: 'asc' },
        skip: (q.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { car: true, seller: userSelect, bidder: userSelect },
      }),
      this.prisma.userCard.findMany({ where: { userId }, select: { carId: true, quantity: true } }),
      this.prisma.player.findUniqueOrThrow({ where: { userId } }),
    ]);
    const qty = new Map(owned.map((o) => [o.carId, o.quantity]));
    return {
      page: q.page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
      balance: player.credits,
      feePercent: economyConfig.auctionFeePercent,
      durations: economyConfig.auctionDurations,
      openLimit: economyConfig.maxOpenAuctions,
      auctions: auctions.map((a) => ({
        id: a.id,
        card: { ...toCardDto(a.car), quantity: qty.get(a.carId) ?? 0 },
        startPrice: a.startPrice,
        currentBid: a.currentBid,
        minBid: minBid(a),
        bidCount: a.bidCount,
        endsAt: a.endsAt,
        seller: { name: a.seller.name, isBot: a.seller.player?.isBot ?? false },
        bidder: a.bidder ? { name: a.bidder.name, isBot: a.bidder.player?.isBot ?? false } : null,
        mine: a.sellerId === userId,
        leading: a.bidderId === userId,
      })),
    };
  }
}
