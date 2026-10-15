import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Rarity } from '@prisma/client';
import { createHash } from 'node:crypto';
import { economyConfig } from '../config';
import { AchievementsService } from '../achievements/achievements.service';
import { toCardDto } from '../cars/card.dto';
import { addCard, lockPlayers, moveCredits } from '../economy/wallet';
import { nextZonedHour, zonedParts } from '../game/zoned-time';
import { PlayerService } from '../player/player.service';
import { PrismaService } from '../prisma/prisma.service';
import { offersAt, SHOP_RULES } from './shop-rotation';

/** Graine secrète : empêche de calculer à l'avance le programme des jours suivants. */
const SECRET =
  process.env.SHOP_SECRET ??
  createHash('sha256')
    .update(`shop:${process.env.BETTER_AUTH_SECRET ?? 'dev'}`)
    .digest('hex');

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly achievements: AchievementsService,
  ) {}

  private async currentOffers(db: Prisma.TransactionClient | PrismaService, now = new Date()) {
    const z = zonedParts(now, economyConfig.timezone);
    const rows = await db.$queryRaw<Array<{ id: number; rarity: Rarity }>>`
      SELECT "id", COALESCE("rarityOverride", "rarity") AS rarity FROM "car" WHERE "active" = true`;
    const pool: Partial<Record<Rarity, number[]>> = {};
    for (const r of rows) (pool[r.rarity] ??= []).push(r.id);
    return { date: z.date, hour: z.hour, offers: offersAt(pool, SECRET, z.date, z.hour) };
  }

  async list(userId: string) {
    const player = await this.players.ensure(this.prisma, userId);
    const now = new Date();
    const { date, hour, offers } = await this.currentOffers(this.prisma, now);
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

  async buy(userId: string, offerKey: string) {
    await this.players.ensure(this.prisma, userId);
    return this.prisma.$transaction(
      async (tx) => {
        await lockPlayers(tx, userId);
        const { offers } = await this.currentOffers(tx);
        const offer = offers.find((o) => o.offerKey === offerKey);
        if (!offer) throw new NotFoundException('Cette offre n’est plus disponible (la boutique a tourné)');
        const already = await tx.shopPurchase.findUnique({ where: { userId_offerKey: { userId, offerKey } } });
        if (already) throw new ConflictException('Vous avez déjà acheté cette offre');

        const purchase = await tx.shopPurchase.create({ data: { userId, offerKey, carId: offer.carId, price: offer.price } });
        const balance = await moveCredits(tx, userId, -offer.price, 'shop', purchase.id);
        const { quantity, isNew } = await addCard(tx, userId, offer.carId);
        await tx.player.update({ where: { userId }, data: { shopPurchases: { increment: 1 } } });
        const car = await tx.car.findUniqueOrThrow({ where: { id: offer.carId } });
        const newAchievements = await this.achievements.evaluate(tx, userId);
        return { card: { ...toCardDto(car), quantity, isNew }, balance, newAchievements };
      },
      { timeout: 15_000 },
    );
  }
}
