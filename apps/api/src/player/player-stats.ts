import { Prisma, PrismaClient } from '@prisma/client';
import { RARITY_INFO } from '../game/rarity';

type Db = PrismaClient | Prisma.TransactionClient;

export interface PlayerStats {
  boostersOpened: number;
  cardsObtained: number;
  uniqueCards: number;
  points: number;
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  maxPerBrand: number;
  countries: number;
  decades: number;
  maxQuantity: number;
}

export type StatKey = keyof PlayerStats;

/** Calcule les statistiques de collection d'un joueur en une requête. */
export async function computePlayerStats(db: Db, userId: string): Promise<PlayerStats> {
  const effectiveRarity = Prisma.sql`COALESCE(c."rarityOverride", c."rarity")`;
  const points = Prisma.raw(
    `CASE ${Object.entries(RARITY_INFO)
      .map(([r, info]) => `WHEN COALESCE(c."rarityOverride", c."rarity") = '${r}' THEN ${info.points}`)
      .join(' ')} ELSE 0 END`,
  );

  const [row] = await db.$queryRaw<Array<Record<string, bigint | number | null>>>`
    SELECT
      COUNT(*)                                                    AS "uniqueCards",
      COALESCE(SUM(${points}), 0)                                 AS "points",
      COUNT(*) FILTER (WHERE ${effectiveRarity} = 'COMMON')       AS "common",
      COUNT(*) FILTER (WHERE ${effectiveRarity} = 'UNCOMMON')     AS "uncommon",
      COUNT(*) FILTER (WHERE ${effectiveRarity} = 'RARE')         AS "rare",
      COUNT(*) FILTER (WHERE ${effectiveRarity} = 'EPIC')         AS "epic",
      COUNT(*) FILTER (WHERE ${effectiveRarity} = 'LEGENDARY')    AS "legendary",
      COUNT(DISTINCT c."country")                                 AS "countries",
      COUNT(DISTINCT (c."yearStart" / 10))                        AS "decades",
      COALESCE(MAX(uc."quantity"), 0)                             AS "maxQuantity"
    FROM "user_card" uc
    JOIN "car" c ON c."id" = uc."carId"
    WHERE uc."userId" = ${userId}`;

  const [brand] = await db.$queryRaw<Array<{ n: bigint }>>`
    SELECT COALESCE(MAX(n), 0) AS n FROM (
      SELECT COUNT(*) AS n FROM "user_card" uc
      JOIN "car" c ON c."id" = uc."carId"
      WHERE uc."userId" = ${userId} AND c."manufacturer" IS NOT NULL
      GROUP BY c."manufacturer"
    ) t`;

  const player = await db.player.findUnique({ where: { userId } });
  const num = (v: unknown) => Number(v ?? 0);

  return {
    boostersOpened: player?.boostersOpened ?? 0,
    cardsObtained: player?.cardsObtained ?? 0,
    uniqueCards: num(row?.uniqueCards),
    points: num(row?.points),
    common: num(row?.common),
    uncommon: num(row?.uncommon),
    rare: num(row?.rare),
    epic: num(row?.epic),
    legendary: num(row?.legendary),
    maxPerBrand: num(brand?.n),
    countries: num(row?.countries),
    decades: num(row?.decades),
    maxQuantity: num(row?.maxQuantity),
  };
}
