import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { economyConfig } from '../../../config';
import { AuctionsService } from '../../marketplace/application/auctions.service';
import { minBid } from '../../marketplace/domain/auction';
import { PlayerProvisioning } from '../../player/application/player-provisioning';
import { BoostersService } from '../../collection/application/boosters.service';
import { effectiveRarity } from '../../catalog/application/card-view';
import { DailyRewardService } from '../../progression/application/daily-reward.service';
import { zonedParts } from '../../../shared/domain/zoned-time';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { TradesService } from '../../marketplace/application/trades.service';
import { PlayerLocks, UnitOfWork } from '../../../shared/application/ports';
import { WalletService } from '../../wallet/application/wallet.service';
import {
  acceptsPriceOffer,
  acceptsSwap,
  auctionStartPrice,
  BOT_NAMES,
  BotProfile,
  botValuation,
  BotStyle,
  decideBid,
  STYLE_PRESETS,
  tradeAskPrice,
} from '../domain/bot-brain';

const env = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

/** Configuration des bots (voir docs/fonctionnel/13-bots.md). */
export const botConfig = {
  enabled: process.env.BOTS_ENABLED !== 'false',
  count: Math.min(env('BOTS_COUNT', 12), BOT_NAMES.length),
  startCredits: env('BOTS_START_CREDITS', 1500),
  /** Fréquence de la boucle (secondes) ; chaque bot n'agit que lorsque son prochain passage est dû. */
  tickSeconds: env('BOTS_TICK_SECONDS', 60),
  /** Bots traités au plus par tour de boucle. */
  perTick: 4,
};

const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

@Injectable()
export class BotsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly boosters: BoostersService,
    private readonly daily: DailyRewardService,
    private readonly provisioning: PlayerProvisioning,
    private readonly auctions: AuctionsService,
    private readonly trades: TradesService,
    private readonly wallet: WalletService,
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
  ) {}

  onModuleInit() {
    if (!botConfig.enabled || process.env.NODE_ENV === 'test' || botConfig.count === 0) return;
    this.timer = setInterval(() => void this.tick(), botConfig.tickSeconds * 1000);
    this.timer.unref();
    setTimeout(() => void this.tick(), 8000).unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Un tour de boucle : crée les bots manquants, puis fait agir ceux dont le passage est dû. */
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.prisma.car.count({ where: { active: true } }))) return; // pas de catalogue, rien à faire
      await this.ensureBots();
      const due = await this.prisma.player.findMany({
        where: { isBot: true, OR: [{ botNextActionAt: null }, { botNextActionAt: { lte: new Date() } }] },
        orderBy: { botNextActionAt: 'asc' },
        take: botConfig.perTick,
      });
      for (const bot of due) {
        const profile = bot.botProfile as unknown as BotProfile;
        try {
          await this.act(bot.userId, profile);
        } catch (err) {
          this.logger.warn(`Bot ${bot.userId} : ${(err as Error).message}`);
        }
        await this.prisma.player.update({ where: { userId: bot.userId }, data: { botNextActionAt: this.nextAction(profile) } });
      }
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.running = false;
    }
  }

  /** Prochain passage : irrégulier, et beaucoup plus espacé la nuit (heure du jeu). */
  private nextAction(profile: BotProfile) {
    const hour = zonedParts(new Date(), economyConfig.timezone).hour;
    const night = hour >= 1 && hour < 7 ? 4 : 1;
    return new Date(Date.now() + profile.activityMinutes * rand(0.5, 1.5) * night * 60_000);
  }

  private async ensureBots() {
    const existing = await this.prisma.player.count({ where: { isBot: true } });
    if (existing >= botConfig.count) return;
    const brands = await this.prisma.car.findMany({
      where: { active: true, manufacturer: { not: null } },
      distinct: ['manufacturer'],
      select: { manufacturer: true },
      take: 200,
    });
    const taken = new Set(
      (await this.prisma.user.findMany({ where: { name: { in: BOT_NAMES } }, select: { name: true } })).map((u) => u.name),
    );
    for (const name of BOT_NAMES.filter((n) => !taken.has(n)).slice(0, botConfig.count - existing)) {
      const style = pick<BotStyle>(['collectionneur', 'marchand', 'econome', 'passionne']);
      const profile: BotProfile = {
        style,
        ...STYLE_PRESETS[style],
        activityMinutes: Math.round(rand(10, 45)),
        favoriteBrand: brands.length && Math.random() < 0.7 ? pick(brands).manufacturer : null,
        likesRacing: Math.random() < 0.3,
      };
      const id = `bot_${randomBytes(12).toString('hex')}`;
      // Pas de compte de connexion (table account) : un bot ne peut pas se connecter.
      await this.prisma.user.create({
        data: { id, name, email: `${id}@bots.garage.invalid`, emailVerified: false },
      });
      await this.provisioning.ensure(id);
      await this.prisma.player.update({
        where: { userId: id },
        data: {
          isBot: true,
          botProfile: profile as unknown as Prisma.InputJsonValue,
          // Arrivées échelonnées sur l'heure qui suit.
          botNextActionAt: new Date(Date.now() + rand(0, 60) * 60_000),
        },
      });
      // Dotation de départ au-delà des crédits de bienvenue : passe par le portefeuille (journal).
      const bonus = botConfig.startCredits - economyConfig.startingCredits;
      if (bonus > 0) {
        await this.uow.run(async () => {
          await this.locks.lock(id);
          await this.wallet.credit(id, bonus, 'bot:dotation');
        });
      }
      this.logger.log(`Bot créé : ${name} (${style}${profile.favoriteBrand ? `, fan de ${profile.favoriteBrand}` : ''})`);
    }
  }

  /** Un passage d'un bot. Chaque étape est indépendante : l'échec de l'une n'empêche pas les autres. */
  private async act(botId: string, profile: BotProfile) {
    await this.claimDaily(botId).catch(() => undefined);
    await this.openBoosters(botId).catch(() => undefined);
    await this.browseAuctions(botId, profile).catch((e) => this.logger.debug(e));
    await this.browseTrades(botId, profile).catch((e) => this.logger.debug(e));
    await this.sellDuplicate(botId, profile).catch((e) => this.logger.debug(e));
  }

  /** Récompense du jour + crédits simulant ses parties de mini-jeux (une fois par jour). */
  private async claimDaily(botId: string) {
    const status = await this.daily.status(botId);
    if (!status.canClaim) return;
    await this.daily.claim(botId);
    const income = Math.round(rand(80, 320));
    await this.uow.run(async () => {
      await this.locks.lock(botId);
      await this.wallet.credit(botId, income, 'bot:jeux');
    });
  }

  private async openBoosters(botId: string) {
    const status = await this.boosters.status(botId);
    const n = Math.min(status.available, Math.ceil(rand(0, 3)));
    for (let i = 0; i < n; i++) await this.boosters.open(botId);
  }

  private async ownedQty(botId: string, carIds: number[]) {
    const rows = await this.prisma.userCard.findMany({ where: { userId: botId, carId: { in: carIds } } });
    return new Map(rows.map((r) => [r.carId, r.quantity]));
  }

  /** Parcourt les enchères (les plus proches de la fin d'abord) et enchérit parfois, selon sa valeur estimée. */
  private async browseAuctions(botId: string, profile: BotProfile) {
    const now = new Date();
    const open = await this.prisma.auction.findMany({
      where: { status: 'OPEN', endsAt: { gt: now }, sellerId: { not: botId }, OR: [{ bidderId: null }, { bidderId: { not: botId } }] },
      orderBy: { endsAt: 'asc' },
      take: 8,
      include: { car: true, seller: { select: { player: { select: { isBot: true } } } } },
    });
    if (!open.length) return;
    const qty = await this.ownedQty(botId, open.map((a) => a.carId));
    const player = await this.prisma.player.findUniqueOrThrow({ where: { userId: botId } });
    let budget = player.credits * 0.6; // garde une réserve
    let bids = 0;
    for (const a of open) {
      if (bids >= 2) break;
      const value = botValuation(profile, { rarity: effectiveRarity(a.car), manufacturer: a.car.manufacturer, racing: a.car.racing }, qty.get(a.carId) ?? 0);
      const amount = decideBid(profile, value, minBid(a), a.endsAt.getTime() - now.getTime(), a.seller.player?.isBot ?? false);
      if (amount === null || amount > budget) continue;
      await this.auctions.bid(botId, a.id, amount).then(
        () => {
          bids++;
          budget -= amount;
        },
        () => undefined, // surenchéri entre-temps, enchère close… on passe
      );
    }
  }

  /** Parcourt la bourse et accepte les échanges avantageux pour lui (en priorité ceux des joueurs). */
  private async browseTrades(botId: string, profile: BotProfile) {
    const offers = await this.prisma.tradeOffer.findMany({
      where: { status: 'OPEN', expiresAt: { gt: new Date() }, sellerId: { not: botId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { offeredCar: true, wantedCar: true, seller: { select: { player: { select: { isBot: true } } } } },
    });
    if (!offers.length) return;
    const qty = await this.ownedQty(botId, offers.flatMap((o) => [o.offeredCarId, ...(o.wantedCarId ? [o.wantedCarId] : [])]));
    const player = await this.prisma.player.findUniqueOrThrow({ where: { userId: botId } });
    for (const o of offers) {
      if (o.seller.player?.isBot && Math.random() < 0.7) continue; // surtout les offres des joueurs
      const facts = { rarity: effectiveRarity(o.offeredCar), manufacturer: o.offeredCar.manufacturer, racing: o.offeredCar.racing };
      const offeredValue = botValuation(profile, facts, qty.get(o.offeredCarId) ?? 0);
      let ok = false;
      if (o.price != null) {
        ok = o.price <= player.credits * 0.6 && acceptsPriceOffer(profile, offeredValue, o.price);
      } else if (o.wantedCar) {
        const wantedQty = qty.get(o.wantedCarId!) ?? 0;
        const wantedValue = botValuation(
          profile,
          { rarity: effectiveRarity(o.wantedCar), manufacturer: o.wantedCar.manufacturer, racing: o.wantedCar.racing },
          wantedQty - 1,
        );
        ok = acceptsSwap(profile, offeredValue, wantedValue, wantedQty);
      }
      if (ok) {
        await this.trades.accept(botId, o.id).catch(() => undefined);
        return; // un échange par passage
      }
    }
  }

  /** Met parfois un doublon en vente : aux enchères (souvent) ou à la bourse. */
  private async sellDuplicate(botId: string, profile: BotProfile) {
    if (Math.random() > profile.sellChance) return;
    const dupes = await this.prisma.userCard.findMany({
      where: { userId: botId, quantity: { gte: 2 } },
      include: { car: true },
      take: 30,
    });
    if (!dupes.length) return;
    const card = pick(dupes).car;
    const facts = { rarity: effectiveRarity(card), manufacturer: card.manufacturer, racing: card.racing };
    const [openAuctions, openTrades] = await Promise.all([
      this.prisma.auction.count({ where: { sellerId: botId, status: 'OPEN' } }),
      this.prisma.tradeOffer.count({ where: { sellerId: botId, status: 'OPEN' } }),
    ]);
    if (openAuctions < 2 && Math.random() < 0.7) {
      await this.auctions.create(botId, {
        carId: card.id,
        startPrice: auctionStartPrice(facts),
        durationHours: pick([1, 3, 3, 6, 12]),
      });
    } else if (openTrades < 2) {
      await this.trades.create(botId, { offeredCarId: card.id, price: tradeAskPrice(profile, facts) });
    }
  }
}
