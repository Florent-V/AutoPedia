import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { Rarity, RARITIES, RARITY_INFO } from '../../catalog/domain/rarity';
import { toCardDto } from '../../catalog/application/card-view';

export interface CollectionFilter {
  search?: string;
  rarity?: Rarity;
  manufacturer?: string;
  category?: 'racing' | 'road';
  owned: 'all' | 'owned' | 'missing';
  sort: 'rarity' | 'name' | 'year' | 'recent';
  page: number;
  pageSize: number;
}

/** Lecture : catalogue vu par un joueur (cartes possédées ou non) et progression par rareté et par marque. */
@Injectable()
export class CollectionQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, q: CollectionFilter) {
    const where: Prisma.CarWhereInput = { active: true };
    const and: Prisma.CarWhereInput[] = [];
    if (q.search) {
      and.push({
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { manufacturer: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    if (q.rarity) {
      and.push({ OR: [{ rarityOverride: q.rarity }, { rarityOverride: null, rarity: q.rarity }] });
    }
    if (q.manufacturer) and.push({ manufacturer: q.manufacturer });
    if (q.category) and.push({ racing: q.category === 'racing' });
    if (q.owned === 'owned') and.push({ owners: { some: { userId } } });
    if (q.owned === 'missing') and.push({ owners: { none: { userId } } });
    if (and.length) where.AND = and;

    const orderBy: Prisma.CarOrderByWithRelationInput[] =
      q.sort === 'name'
        ? [{ name: 'asc' }]
        : q.sort === 'year'
          ? [{ yearStart: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }]
          : q.sort === 'recent'
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : [{ rarity: 'desc' }, { popularity: 'desc' }, { name: 'asc' }];

    const [total, cars] = await Promise.all([
      this.prisma.car.count({ where }),
      this.prisma.car.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { owners: { where: { userId }, select: { quantity: true, firstObtainedAt: true } } },
      }),
    ]);

    return {
      page: q.page,
      pageSize: q.pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / q.pageSize)),
      items: cars.map(({ owners, ...car }) => ({
        ...toCardDto(car),
        quantity: owners[0]?.quantity ?? 0,
        firstObtainedAt: owners[0]?.firstObtainedAt ?? null,
      })),
    };
  }

  async summary(userId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ rarity: string; total: bigint; owned: bigint }>>`
      SELECT COALESCE(c."rarityOverride", c."rarity")::text AS rarity,
             COUNT(*) AS total,
             COUNT(uc."carId") AS owned
      FROM "car" c
      LEFT JOIN "user_card" uc ON uc."carId" = c."id" AND uc."userId" = ${userId}
      WHERE c."active" = true
      GROUP BY 1`;
    const byRarity = new Map(rows.map((r) => [r.rarity, r]));

    const brands = await this.prisma.$queryRaw<Array<{ manufacturer: string; total: bigint; owned: bigint }>>`
      SELECT c."manufacturer", COUNT(*) AS total, COUNT(uc."carId") AS owned
      FROM "car" c
      LEFT JOIN "user_card" uc ON uc."carId" = c."id" AND uc."userId" = ${userId}
      WHERE c."active" = true AND c."manufacturer" IS NOT NULL
      GROUP BY c."manufacturer"
      ORDER BY COUNT(*) DESC, c."manufacturer" ASC`;

    return {
      rarities: RARITIES.map((r) => ({
        rarity: r,
        label: RARITY_INFO[r].label,
        points: RARITY_INFO[r].points,
        total: Number(byRarity.get(r)?.total ?? 0),
        owned: Number(byRarity.get(r)?.owned ?? 0),
      })),
      manufacturers: brands.map((b) => ({ name: b.manufacturer, total: Number(b.total), owned: Number(b.owned) })),
    };
  }
}
