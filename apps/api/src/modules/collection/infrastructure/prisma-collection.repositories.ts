import { Injectable } from '@nestjs/common';
import { NotFound } from '../../../shared/domain/errors';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { Rarity } from '../../catalog/domain/rarity';
import { BoosterReserve, BoosterReserveRepository } from '../domain/booster-reserve';
import { CarPool, OwnedCards } from '../domain/ports';

@Injectable()
export class PrismaBoosterReserveRepository extends BoosterReserveRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async get(userId: string) {
    const p = await this.db.tx.player.findUnique({
      where: { userId },
      select: { boosters: true, boosterAnchor: true, boostersOpened: true, cardsObtained: true, sinceEpic: true, sinceLegendary: true },
    });
    if (!p) throw new NotFound('Joueur introuvable');
    return BoosterReserve.restore({
      userId,
      boosters: p.boosters,
      anchor: p.boosterAnchor,
      boostersOpened: p.boostersOpened,
      cardsObtained: p.cardsObtained,
      sinceEpic: p.sinceEpic,
      sinceLegendary: p.sinceLegendary,
    });
  }

  async save(reserve: BoosterReserve) {
    const s = reserve.snapshot();
    await this.db.tx.player.update({
      where: { userId: s.userId },
      data: {
        boosters: s.boosters,
        boosterAnchor: s.anchor,
        boostersOpened: s.boostersOpened,
        cardsObtained: s.cardsObtained,
        sinceEpic: s.sinceEpic,
        sinceLegendary: s.sinceLegendary,
      },
    });
  }

  async recordOpening(userId: string, carIds: number[]) {
    await this.db.tx.boosterOpening.create({ data: { userId, carIds } });
  }
}

@Injectable()
export class PrismaOwnedCards extends OwnedCards {
  constructor(private readonly db: Db) {
    super();
  }

  async add(userId: string, carId: number, at: Date) {
    const key = { userId_carId: { userId, carId } };
    const existing = await this.db.tx.userCard.findUnique({ where: key, select: { quantity: true } });
    const card = await this.db.tx.userCard.upsert({
      where: key,
      create: { userId, carId, quantity: 1, firstObtainedAt: at, lastObtainedAt: at },
      update: { quantity: { increment: 1 }, lastObtainedAt: at },
    });
    return { quantity: card.quantity, isNew: !existing };
  }

  async remove(userId: string, carId: number) {
    const key = { userId_carId: { userId, carId } };
    // Décrément conditionnel : jamais de quantité négative, même sans verrou.
    const decremented = await this.db.tx.userCard.updateMany({
      where: { userId, carId, quantity: { gt: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (decremented.count) return true;
    const deleted = await this.db.tx.userCard.deleteMany({ where: { ...key.userId_carId, quantity: 1 } });
    return deleted.count > 0;
  }

  async quantity(userId: string, carId: number) {
    const card = await this.db.tx.userCard.findUnique({ where: { userId_carId: { userId, carId } }, select: { quantity: true } });
    return card?.quantity ?? 0;
  }
}

/** Adaptateur : le tirage passe par le contexte Catalogue. */
@Injectable()
export class CatalogCarPool extends CarPool {
  constructor(private readonly catalog: CatalogReader) {
    super();
  }

  pick(rarity: Rarity, exclude: number[]) {
    return this.catalog.randomCar(rarity, exclude);
  }
}
