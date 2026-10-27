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
import { Prisma, TradeOffer } from '@prisma/client';
import { economyConfig, jobsConfig } from '../config';
import { AchievementsService } from '../achievements/achievements.service';
import { toCardDto } from '../cars/card.dto';
import { addCard, lockPlayers, moveCredits, removeCard } from '../economy/wallet';
import { PlayerService } from '../player/player.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

export interface CreateTrade {
  offeredCarId: number;
  wantedCarId?: number;
  price?: number;
}

export interface TradeQuery {
  tab: 'all' | 'mine' | 'forme';
  rarity?: string;
  search?: string;
  page: number;
}

const PAGE_SIZE = 24;

@Injectable()
export class TradesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TradesService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly achievements: AchievementsService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    if (!jobsConfig.enabled) return;
    const run = () => void this.expire().catch((e) => this.logger.error(e));
    setTimeout(run, Math.min(3000, jobsConfig.tradeExpireMs)).unref();
    this.timer = setInterval(run, jobsConfig.tradeExpireMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async create(userId: string, input: CreateTrade) {
    if ((input.wantedCarId == null) === (input.price == null)) {
      throw new BadRequestException('Indiquez soit une carte demandée en échange, soit un prix en crédits');
    }
    if (input.wantedCarId === input.offeredCarId) throw new BadRequestException('Impossible d’échanger une carte contre elle-même');
    await this.players.ensure(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      await lockPlayers(tx, userId);
      const open = await tx.tradeOffer.count({ where: { sellerId: userId, status: 'OPEN' } });
      if (open >= economyConfig.maxOpenTrades) {
        throw new ConflictException(`Vous avez déjà ${open} offres ouvertes (maximum ${economyConfig.maxOpenTrades})`);
      }
      if (input.wantedCarId != null) {
        const wanted = await tx.car.findFirst({ where: { id: input.wantedCarId, active: true } });
        if (!wanted) throw new NotFoundException('Carte demandée introuvable');
      }
      // Séquestre : la carte quitte la collection tant que l'offre est ouverte.
      await removeCard(tx, userId, input.offeredCarId);
      const offer = await tx.tradeOffer.create({
        data: {
          sellerId: userId,
          offeredCarId: input.offeredCarId,
          wantedCarId: input.wantedCarId ?? null,
          price: input.price ?? null,
          expiresAt: new Date(Date.now() + economyConfig.tradeDays * 24 * 3600 * 1000),
        },
      });
      return { id: offer.id };
    });
  }

  async cancel(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await this.lockOffer(tx, id);
      if (offer.sellerId !== userId) throw new ForbiddenException('Cette offre ne vous appartient pas');
      await this.close(tx, offer, 'CANCELLED');
      return { ok: true };
    });
  }

  async accept(userId: string, id: string) {
    await this.players.ensure(this.prisma, userId);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const offer = await this.lockOffer(tx, id);
        if (offer.sellerId === userId) throw new BadRequestException('Vous ne pouvez pas accepter votre propre offre');
        if (offer.expiresAt < new Date()) throw new ConflictException('Cette offre a expiré');
        await lockPlayers(tx, userId, offer.sellerId);

        if (offer.wantedCarId != null) {
          await removeCard(tx, userId, offer.wantedCarId);
          await addCard(tx, offer.sellerId, offer.wantedCarId);
        } else {
          await moveCredits(tx, userId, -offer.price!, 'trade:purchase', offer.id);
          await moveCredits(tx, offer.sellerId, offer.price!, 'trade:sale', offer.id);
        }
        const { quantity, isNew } = await addCard(tx, userId, offer.offeredCarId);
        await tx.tradeOffer.update({ where: { id }, data: { status: 'COMPLETED', buyerId: userId, closedAt: new Date() } });
        await tx.player.updateMany({ where: { userId: { in: [userId, offer.sellerId] } }, data: { tradesCompleted: { increment: 1 } } });

        const [car, newAchievements] = await Promise.all([
          tx.car.findUniqueOrThrow({ where: { id: offer.offeredCarId } }),
          this.achievements.evaluate(tx, userId),
        ]);
        await this.achievements.evaluate(tx, offer.sellerId);
        const balance = (await tx.player.findUniqueOrThrow({ where: { userId }, select: { credits: true } })).credits;
        return { offer, card: { ...toCardDto(car), quantity, isNew }, balance, newAchievements };
      },
      { timeout: 15_000 },
    );

    // Prévient le vendeur (hors transaction, sans bloquer la réponse).
    void this.push
      .sendToUser(result.offer.sellerId, {
        title: 'Échange conclu 🤝',
        body: `Votre « ${result.card.name} » a trouvé preneur à la bourse.`,
        url: '/market?tab=trades',
        tag: `trade-${result.offer.id}`,
      })
      .catch(() => undefined);
    const { offer, ...rest } = result;
    return { ...rest, tradeId: offer.id };
  }

  async list(userId: string, q: TradeQuery) {
    const now = new Date();
    const where: Prisma.TradeOfferWhereInput = { status: 'OPEN', expiresAt: { gt: now } };
    const and: Prisma.TradeOfferWhereInput[] = [];
    if (q.tab === 'mine') and.push({ sellerId: userId });
    else and.push({ sellerId: { not: userId } });
    if (q.tab === 'forme') {
      // Offres intéressantes : la carte proposée me manque, et je peux payer ou je possède la carte demandée.
      const [owned, player] = await Promise.all([
        this.prisma.userCard.findMany({ where: { userId }, select: { carId: true } }),
        this.players.ensure(this.prisma, userId),
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
      this.players.ensure(this.prisma, userId),
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

  /** Clôt les offres expirées et rend les cartes sous séquestre à leurs propriétaires. */
  async expire() {
    const expired = await this.prisma.tradeOffer.findMany({ where: { status: 'OPEN', expiresAt: { lte: new Date() } }, select: { id: true } });
    for (const { id } of expired) {
      await this.prisma
        .$transaction(async (tx) => this.close(tx, await this.lockOffer(tx, id), 'CANCELLED'))
        .catch(() => undefined);
    }
    if (expired.length) this.logger.log(`Offres expirées : ${expired.length}`);
  }

  private async lockOffer(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT 1 FROM "trade_offer" WHERE "id" = ${id} FOR UPDATE`;
    const offer = await tx.tradeOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offre introuvable');
    if (offer.status !== 'OPEN') throw new ConflictException('Cette offre n’est plus disponible');
    return offer;
  }

  private async close(tx: Prisma.TransactionClient, offer: TradeOffer, status: 'CANCELLED') {
    await addCard(tx, offer.sellerId, offer.offeredCarId);
    await tx.tradeOffer.update({ where: { id: offer.id }, data: { status, closedAt: new Date() } });
  }
}
