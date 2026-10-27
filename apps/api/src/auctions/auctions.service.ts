import { legacyTransaction } from '../shared/infrastructure/prisma/legacy-transaction';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Auction, Prisma } from '@prisma/client';
import { economyConfig, jobsConfig } from '../config';
import { AchievementsService } from '../modules/progression/application/achievements.service';
import { toCardDto } from '../modules/catalog/application/card-view';
import { addCard, lockPlayers, moveCredits, removeCard } from '../economy/wallet';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { PushService } from '../push/push.service';

type Tx = Prisma.TransactionClient;

export interface AuctionQuery {
  tab: 'all' | 'selling' | 'bidding';
  rarity?: string;
  search?: string;
  page: number;
}

const PAGE_SIZE = 24;

/** Offre minimale acceptée : le prix de départ, puis +5 % (au moins 1 crédit) au-dessus de la meilleure offre. */
export function minBid(a: Pick<Auction, 'startPrice' | 'currentBid'>): number {
  if (a.currentBid == null) return a.startPrice;
  return a.currentBid + Math.max(1, Math.ceil(a.currentBid * 0.05));
}

@Injectable()
export class AuctionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuctionsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    if (!jobsConfig.enabled) return;
    const run = () => void this.settleDue().catch((e) => this.logger.error(e));
    setTimeout(run, Math.min(3000, jobsConfig.auctionSettleMs)).unref();
    this.timer = setInterval(run, jobsConfig.auctionSettleMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async create(userId: string, input: { carId: number; startPrice: number; durationHours: number }) {
    if (!economyConfig.auctionDurations.includes(input.durationHours)) {
      throw new BadRequestException(`Durée invalide (${economyConfig.auctionDurations.join(', ')} heures)`);
    }
    return legacyTransaction(async (tx) => {
      await lockPlayers(tx, userId);
      const open = await tx.auction.count({ where: { sellerId: userId, status: 'OPEN' } });
      if (open >= economyConfig.maxOpenAuctions) {
        throw new ConflictException(`Vous avez déjà ${open} enchères en cours (maximum ${economyConfig.maxOpenAuctions})`);
      }
      // Séquestre : la carte quitte la collection jusqu'à la fin de l'enchère.
      await removeCard(tx, userId, input.carId);
      const auction = await tx.auction.create({
        data: {
          sellerId: userId,
          carId: input.carId,
          startPrice: input.startPrice,
          endsAt: new Date(Date.now() + input.durationHours * 3600 * 1000),
        },
      });
      return { id: auction.id };
    });
  }

  async bid(userId: string, id: string, amount: number) {
    const result = await legacyTransaction(
      async (tx) => {
        const auction = await this.lockAuction(tx, id);
        const now = new Date();
        if (auction.endsAt <= now) throw new ConflictException('Cette enchère est terminée');
        if (auction.sellerId === userId) throw new BadRequestException('Vous ne pouvez pas enchérir sur votre propre vente');
        if (auction.bidderId === userId) throw new ConflictException('Vous êtes déjà le meilleur enchérisseur');
        const min = minBid(auction);
        if (amount < min) throw new BadRequestException(`L’offre minimale est de ${min} crédits`);

        const previous = auction.bidderId ? { userId: auction.bidderId, amount: auction.currentBid! } : null;
        await lockPlayers(tx, userId, ...(previous ? [previous.userId] : []));
        // Les crédits de la nouvelle offre sont bloqués ; l'ancien meilleur enchérisseur est remboursé.
        await moveCredits(tx, userId, -amount, 'auction:bid', auction.id);
        if (previous) await moveCredits(tx, previous.userId, previous.amount, 'auction:refund', auction.id);

        const snipe = economyConfig.auctionSnipeSeconds * 1000;
        const endsAt = auction.endsAt.getTime() - now.getTime() < snipe ? new Date(now.getTime() + snipe) : auction.endsAt;
        await tx.bid.create({ data: { auctionId: auction.id, userId, amount } });
        const updated = await tx.auction.update({
          where: { id },
          data: { currentBid: amount, bidderId: userId, bidCount: { increment: 1 }, endsAt },
          include: { car: true },
        });
        const balance = (await tx.player.findUniqueOrThrow({ where: { userId }, select: { credits: true } })).credits;
        return { updated, previous, balance };
      },
      { timeout: 15_000 },
    );

    if (result.previous) {
      void this.push
        .sendToUser(result.previous.userId, {
          title: 'Vous avez été surenchéri ⚠️',
          body: `« ${result.updated.car.name} » : nouvelle offre à ${result.updated.currentBid} crédits. Vos crédits vous ont été rendus.`,
          url: '/market?tab=auctions',
          tag: `auction-${id}`,
        })
        .catch(() => undefined);
    }
    return {
      id,
      currentBid: result.updated.currentBid,
      minBid: minBid(result.updated),
      endsAt: result.updated.endsAt,
      balance: result.balance,
    };
  }

  async cancel(userId: string, id: string) {
    return legacyTransaction(async (tx) => {
      const auction = await this.lockAuction(tx, id);
      if (auction.sellerId !== userId) throw new ForbiddenException('Cette enchère ne vous appartient pas');
      if (auction.bidCount > 0) throw new ConflictException('Impossible d’annuler : une offre a déjà été faite');
      await addCard(tx, userId, auction.carId);
      await tx.auction.update({ where: { id }, data: { status: 'CANCELLED', closedAt: new Date() } });
      return { ok: true };
    });
  }

  async list(userId: string, q: AuctionQuery) {
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

  /** Clôt les enchères arrivées à échéance : carte à l'acheteur, crédits au vendeur (moins la commission). */
  async settleDue() {
    const due = await this.prisma.auction.findMany({
      where: { status: 'OPEN', endsAt: { lte: new Date() } },
      select: { id: true },
      take: 200,
    });
    for (const { id } of due) {
      try {
        const done = await legacyTransaction((tx) => this.settle(tx, id), { timeout: 15_000 });
        if (done?.status === 'SOLD') {
          void this.push
            .sendToUser(done.bidderId!, {
              title: 'Enchère remportée 🔨',
              body: `« ${done.car.name} » rejoint votre garage pour ${done.currentBid} crédits.`,
              url: '/collection',
              tag: `auction-${id}`,
            })
            .catch(() => undefined);
          void this.push
            .sendToUser(done.sellerId, {
              title: 'Vente aux enchères conclue 💰',
              body: `« ${done.car.name} » est parti pour ${done.currentBid} crédits.`,
              url: '/market?tab=auctions',
              tag: `auction-${id}`,
            })
            .catch(() => undefined);
        }
      } catch (err) {
        this.logger.warn(`Règlement de l'enchère ${id} impossible : ${(err as Error).message}`);
      }
    }
  }

  private async settle(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT 1 FROM "auction" WHERE "id" = ${id} FOR UPDATE`;
    const auction = await tx.auction.findUnique({ where: { id }, include: { car: true } });
    if (!auction || auction.status !== 'OPEN' || auction.endsAt > new Date()) return null;
    const closedAt = new Date();
    if (!auction.bidderId) {
      // Aucune offre : la carte revient au vendeur.
      await addCard(tx, auction.sellerId, auction.carId);
      return tx.auction.update({ where: { id }, data: { status: 'UNSOLD', closedAt }, include: { car: true } });
    }
    await lockPlayers(tx, auction.sellerId, auction.bidderId);
    const fee = Math.floor((auction.currentBid! * economyConfig.auctionFeePercent) / 100);
    await addCard(tx, auction.bidderId, auction.carId);
    await moveCredits(tx, auction.sellerId, auction.currentBid! - fee, 'auction:sale', auction.id);
    await tx.player.update({ where: { userId: auction.bidderId }, data: { auctionsWon: { increment: 1 } } });
    await tx.player.update({ where: { userId: auction.sellerId }, data: { auctionsSold: { increment: 1 } } });
    await this.achievements.evaluate(auction.bidderId);
    await this.achievements.evaluate(auction.sellerId);
    return tx.auction.update({ where: { id }, data: { status: 'SOLD', closedAt }, include: { car: true } });
  }

  private async lockAuction(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT 1 FROM "auction" WHERE "id" = ${id} FOR UPDATE`;
    const auction = await tx.auction.findUnique({ where: { id } });
    if (!auction) throw new NotFoundException('Enchère introuvable');
    if (auction.status !== 'OPEN') throw new ConflictException('Cette enchère est terminée');
    return auction;
  }
}
