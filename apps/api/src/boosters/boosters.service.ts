import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Car, Prisma, Rarity } from '@prisma/client';
import { economyConfig, gameConfig } from '../config';
import { consumeBooster } from '../game/booster-clock';
import { Pity, pityFor, RARITIES, rarityRank, rollBoosterRarities } from '../game/rarity';
import { addCard } from '../economy/wallet';
import { PrismaService } from '../prisma/prisma.service';
import { boosterView, PlayerService } from '../player/player.service';
import { computePlayerStats } from '../player/player-stats';
import { AchievementsService } from '../achievements/achievements.service';
import { effectiveRarity, toCardDto } from '../cars/card.dto';

@Injectable()
export class BoostersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly achievements: AchievementsService,
  ) {}

  async status(userId: string) {
    const player = await this.players.ensure(this.prisma, userId);
    return boosterView(this.players.status(player));
  }

  async open(userId: string) {
    await this.players.ensure(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      // Verrou sur la ligne du joueur : empêche d'ouvrir deux fois le même booster en parallèle.
      await tx.$queryRaw`SELECT 1 FROM "player" WHERE "userId" = ${userId} FOR UPDATE`;
      const player = await tx.player.findUniqueOrThrow({ where: { userId } });
      const now = new Date();
      const status = this.players.status(player, now);
      if (status.boosters <= 0) {
        throw new ConflictException({
          message: 'Aucun booster disponible pour le moment',
          boosters: boosterView(status, now),
        });
      }

      const pity = pityFor(player.sinceEpic, player.sinceLegendary, economyConfig.pityEpic, economyConfig.pityLegendary);
      const cars = await this.drawCards(tx, gameConfig.cardsPerBooster, pity);
      const after = consumeBooster(status, now);
      const rarities = cars.map((c) => effectiveRarity(c));
      const gotLegendary = rarities.includes('LEGENDARY');
      const gotEpic = gotLegendary || rarities.includes('EPIC');

      await tx.player.update({
        where: { userId },
        data: {
          boosters: after.boosters,
          boosterAnchor: after.anchor,
          boostersOpened: { increment: 1 },
          cardsObtained: { increment: cars.length },
          sinceEpic: gotEpic ? 0 : { increment: 1 },
          sinceLegendary: gotLegendary ? 0 : { increment: 1 },
        },
      });

      const cards = [];
      for (const car of cars) {
        const { quantity, isNew } = await addCard(tx, userId, car.id, now);
        cards.push({ ...toCardDto(car), isNew, quantity });
      }

      await tx.boosterOpening.create({ data: { userId, carIds: cars.map((c) => c.id) } });

      const stats = await computePlayerStats(tx, userId);
      const newAchievements = await this.achievements.evaluate(tx, userId, stats);

      return {
        cards,
        boosters: boosterView(after, now),
        stats,
        newAchievements,
        pity: { epic: !!pity.epic, legendary: !!pity.legendary },
      };
    }, { timeout: 15_000 });
  }

  /** Tire les cartes d'un booster, sans doublon au sein d'un même booster. */
  private async drawCards(tx: Prisma.TransactionClient, count: number, pity: Pity = {}): Promise<Car[]> {
    const slots = rollBoosterRarities(count, Math.random, pity);
    const picked: Car[] = [];
    for (const wanted of slots) {
      const car = await this.pickCar(tx, wanted, picked.map((c) => c.id));
      if (!car) {
        throw new ServiceUnavailableException(
          "Le catalogue de cartes est vide : lancez l'import (voir README) puis réessayez.",
        );
      }
      picked.push(car);
    }
    return picked;
  }

  /** Choisit une voiture aléatoire de la rareté demandée, en se rabattant sur la plus proche si besoin. */
  async pickCar(tx: Prisma.TransactionClient, wanted: Rarity, exclude: number[]): Promise<Car | null> {
    const order = [...RARITIES].sort(
      (a, b) => Math.abs(rarityRank(a) - rarityRank(wanted)) - Math.abs(rarityRank(b) - rarityRank(wanted)),
    );
    for (const excluded of [exclude, []]) {
      for (const rarity of order) {
        const rows = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "car"
          WHERE "active" = true
            AND COALESCE("rarityOverride", "rarity") = ${rarity}::"Rarity"
            AND NOT ("id" = ANY(${excluded}::int[]))
          ORDER BY random() LIMIT 1`;
        if (rows.length) return tx.car.findUnique({ where: { id: rows[0].id } });
      }
    }
    return null;
  }
}
