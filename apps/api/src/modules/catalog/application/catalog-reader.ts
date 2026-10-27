import { Injectable } from '@nestjs/common';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { effectiveRarity, nearestRarities, Rarity } from '../domain/rarity';
import { CardDto, toCardDto } from './card-view';

/**
 * Lecture du catalogue pour les autres contextes : vues des cartes et tirage au sort.
 * Lit dans la transaction en cours s'il y en a une.
 */
@Injectable()
export class CatalogReader {
  constructor(private readonly db: Db) {}

  async views(ids: number[]): Promise<Map<number, CardDto>> {
    const cars = await this.db.tx.car.findMany({ where: { id: { in: [...new Set(ids)] } } });
    return new Map(cars.map((c) => [c.id, toCardDto(c)]));
  }

  async view(id: number): Promise<CardDto | null> {
    const car = await this.db.tx.car.findUnique({ where: { id } });
    return car ? toCardDto(car) : null;
  }

  /** La carte existe et peut être échangée ou vendue. */
  async exists(id: number) {
    return (await this.db.tx.car.count({ where: { id, active: true } })) > 0;
  }

  activeCount() {
    return this.db.tx.car.count({ where: { active: true } });
  }

  /** Carte active au hasard de la rareté voulue, sinon de la plus proche ; hors `exclude` si possible. */
  async randomCar(wanted: Rarity, exclude: number[] = []): Promise<{ id: number; rarity: Rarity } | null> {
    for (const excluded of [exclude, []]) {
      for (const rarity of nearestRarities(wanted)) {
        const rows = await this.db.tx.$queryRaw<Array<{ id: number; rarity: Rarity; rarityOverride: Rarity | null }>>`
          SELECT "id", "rarity", "rarityOverride" FROM "car"
          WHERE "active" = true
            AND COALESCE("rarityOverride", "rarity") = ${rarity}::"Rarity"
            AND NOT ("id" = ANY(${excluded}::int[]))
          ORDER BY random() LIMIT 1`;
        if (rows.length) return { id: rows[0].id, rarity: effectiveRarity(rows[0]) };
      }
    }
    return null;
  }
}
