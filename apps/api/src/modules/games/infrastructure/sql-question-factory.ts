import { Injectable } from '@nestjs/common';
import { Car, Prisma } from '@prisma/client';
import { RandomSource } from '../../../shared/application/ports';
import { Random, shuffle as shuffleWith } from '../../../shared/domain/random';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { imageUrlOf } from '../../catalog/application/card-view';
import { effectiveRarity, Rarity, rollRarity } from '../../catalog/domain/rarity';
import { GameType } from '../domain/game-rules';
import { QuestionFactory } from '../domain/ports';
import { DoorsRound, DuelRound, DuelStatKey, GameCard, MysteryRound, QuizRound, Round } from '../domain/rounds';

type Tx = Prisma.TransactionClient;

/** Questions tirées du catalogue en SQL. Tout l'aléatoire passe par `random` (cryptographique en production). */
@Injectable()
export class SqlQuestionFactory extends QuestionFactory {
  constructor(
    private readonly db: Db,
    private readonly randomSource: RandomSource,
  ) {
    super();
  }

  make(type: GameType, used: number[]): Promise<Round | null> {
    const tx = this.db.tx;
    const random: Random = () => this.randomSource.next();
    switch (type) {
      case 'DUEL':
        return makeDuelRound(tx, used, random);
      case 'QUIZ':
        return makeQuizRound(tx, used, random);
      case 'WEIGHT':
        return makeWeightRound(tx, used, random);
      case 'MYSTERY':
        return makeMysteryRound(tx, used, random);
      case 'DOORS':
        return makeDoorsRound(tx, random);
    }
  }
}

/** Carte réduite envoyée pendant un jeu : jamais les valeurs qui donneraient la réponse. */
export function gameCard(car: Car): GameCard {
  return {
    id: car.id,
    name: car.name,
    manufacturer: car.manufacturer,
    imageUrl: imageUrlOf(car),
    rarity: effectiveRarity(car),
  };
}

// ---------------------------------------------------------------------------
// Duel de stats
// ---------------------------------------------------------------------------

export interface DuelStat {
  key: DuelStatKey;
  question: string;
  /** La bonne réponse est la plus grande valeur (sinon la plus petite). */
  higher: boolean;
  format: (v: number) => string;
  /** Écart minimal pour que la question soit équitable. */
  minGap: (a: number, b: number) => boolean;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);
const relGap = (pct: number) => (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) >= pct;

export const DUEL_STATS: DuelStat[] = [
  { key: 'topSpeedKmh', question: 'Laquelle est la plus rapide ?', higher: true, format: (v) => `${fmt(v)} km/h`, minGap: relGap(0.06) },
  { key: 'powerKw', question: 'Laquelle est la plus puissante ?', higher: true, format: (v) => `${fmt(v * 1.35962)} ch`, minGap: relGap(0.1) },
  { key: 'massKg', question: 'Laquelle est la plus lourde ?', higher: true, format: (v) => `${fmt(v)} kg`, minGap: relGap(0.08) },
  { key: 'lengthMm', question: 'Laquelle est la plus longue ?', higher: true, format: (v) => `${fmt(v / 1000)} m`, minGap: relGap(0.05) },
  { key: 'yearStart', question: 'Laquelle est sortie en premier ?', higher: false, format: (v) => `${v}`, minGap: (a, b) => Math.abs(a - b) >= 3 },
  {
    key: 'popularity',
    question: 'Laquelle est la plus célèbre ? (nombre de Wikipédias qui lui consacrent un article)',
    higher: true,
    format: (v) => `${v} wikis`,
    minGap: (a, b) => Math.abs(a - b) >= 4,
  },
];

export async function makeDuelRound(tx: Tx, used: number[], random: Random): Promise<DuelRound | null> {
  const stats = shuffleWith(DUEL_STATS, random);
  for (const stat of stats) {
    const col = Prisma.raw(`"${stat.key}"`);
    const rows = await tx.$queryRaw<Array<{ id: number; v: number }>>`
      SELECT "id", ${col}::float8 AS v FROM "car"
      WHERE "active" = true AND ${col} IS NOT NULL AND ${col} > 0 AND NOT ("id" = ANY(${used}::int[]))
      ORDER BY random() LIMIT 40`;
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const [x, y] = [rows[i], rows[j]];
        if (!stat.minGap(x.v, y.v)) continue;
        const cars = await tx.car.findMany({ where: { id: { in: [x.id, y.id] } } });
        const ca = cars.find((c) => c.id === x.id)!;
        const cb = cars.find((c) => c.id === y.id)!;
        const aWins = stat.higher ? x.v > y.v : x.v < y.v;
        return {
          stat: stat.key,
          question: stat.question,
          a: gameCard(ca),
          b: gameCard(cb),
          answer: aWins ? 'a' : 'b',
          reveal: { a: stat.format(x.v), b: stat.format(y.v) },
        };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quiz auto (4 choix)
// ---------------------------------------------------------------------------

async function randomCar(tx: Tx, where: Prisma.Sql, used: number[]): Promise<Car | null> {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "car" WHERE "active" = true AND ${where} AND NOT ("id" = ANY(${used}::int[]))
    ORDER BY random() LIMIT 1`;
  return rows.length ? tx.car.findUnique({ where: { id: rows[0].id } }) : null;
}

async function distinctValues(tx: Tx, column: 'manufacturer' | 'country', exclude: string, n: number) {
  const col = Prisma.raw(`"${column}"`);
  const rows = await tx.$queryRaw<Array<{ v: string }>>`
    SELECT v FROM (SELECT DISTINCT ${col} AS v FROM "car" WHERE "active" = true AND ${col} IS NOT NULL AND ${col} <> ${exclude}) t
    ORDER BY random() LIMIT ${n}`;
  return rows.map((r) => r.v);
}

function build(
  kind: QuizRound['kind'],
  prompt: string,
  car: Car,
  correct: string,
  others: string[],
  random: Random,
  showName = true,
): QuizRound | null {
  if (others.length < 3) return null;
  const choices = shuffleWith([correct, ...others.slice(0, 3)], random);
  return {
    kind,
    prompt,
    car: { name: showName ? car.name : null, imageUrl: imageUrlOf(car) },
    choices,
    answer: choices.indexOf(correct),
    carId: car.id,
  };
}

export async function makeQuizRound(tx: Tx, used: number[], random: Random): Promise<QuizRound | null> {
  const kinds = shuffleWith<QuizRound['kind']>(['brand', 'country', 'decade', 'photo'], random);
  for (const kind of kinds) {
    if (kind === 'brand') {
      const car = await randomCar(tx, Prisma.sql`"manufacturer" IS NOT NULL`, used);
      if (!car) continue;
      const q = build('brand', `Quelle marque produit la « ${car.name} » ?`, car, car.manufacturer!, await distinctValues(tx, 'manufacturer', car.manufacturer!, 3), random);
      // Trop facile si le nom contient la marque : on le masque alors.
      if (q && car.name.toLowerCase().includes(car.manufacturer!.toLowerCase())) {
        q.prompt = 'Quelle marque a produit cette voiture ?';
        q.car.name = null;
        if (!q.car.imageUrl) continue;
      }
      if (q) return q;
    }
    if (kind === 'country') {
      const car = await randomCar(tx, Prisma.sql`"country" IS NOT NULL`, used);
      if (!car) continue;
      const q = build('country', `De quel pays vient la « ${car.name} » ?`, car, car.country!, await distinctValues(tx, 'country', car.country!, 3), random);
      if (q) return q;
    }
    if (kind === 'decade') {
      const car = await randomCar(tx, Prisma.sql`"yearStart" IS NOT NULL`, used);
      if (!car) continue;
      const decade = Math.floor(car.yearStart! / 10) * 10;
      const candidates = [-30, -20, -10, 10, 20, 30].map((d) => decade + d).filter((d) => d >= 1880 && d <= 2030);
      const others = shuffleWith(candidates, random).slice(0, 3);
      const q = build('decade', `En quelle décennie la « ${car.name} » est-elle sortie ?`, car, `Années ${decade}`, others.map((d) => `Années ${d}`), random);
      if (q) {
        // Décennies présentées dans l'ordre chronologique.
        const correct = q.choices[q.answer];
        q.choices.sort();
        q.answer = q.choices.indexOf(correct);
        return q;
      }
    }
    if (kind === 'photo') {
      const car = await randomCar(tx, Prisma.sql`"imagePath" IS NOT NULL`, used);
      if (!car) continue;
      const rows = await tx.$queryRaw<Array<{ name: string }>>`
        SELECT "name" FROM "car" WHERE "active" = true AND "id" <> ${car.id} AND "name" <> ${car.name}
        ORDER BY ("manufacturer" IS NOT DISTINCT FROM ${car.manufacturer}) DESC, random() LIMIT 3`;
      const q = build('photo', 'Quel est ce modèle ?', car, car.name, rows.map((r) => r.name), random, false);
      if (q) return q;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Jeux « une carte à gagner »
// ---------------------------------------------------------------------------

/** Voiture aléatoire d'une rareté donnée (ou de n'importe quelle rareté) respectant une condition. */
async function randomCarOf(tx: Tx, rarity: Rarity | null, where: Prisma.Sql, used: number[]): Promise<Car | null> {
  const rarityFilter = rarity ? Prisma.sql`AND COALESCE("rarityOverride", "rarity") = ${rarity}::"Rarity"` : Prisma.empty;
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "car"
    WHERE "active" = true AND ${where} ${rarityFilter} AND NOT ("id" = ANY(${used}::int[]))
    ORDER BY random() LIMIT 1`;
  return rows.length ? tx.car.findUnique({ where: { id: rows[0].id } }) : null;
}

/**
 * Poids lourds : deux voitures dont la rareté est tirée comme dans un booster, la plus lourde est à gagner.
 * Si le catalogue manque de masses connues, on se rabat sur un autre critère du duel.
 */
export async function makeWeightRound(tx: Tx, used: number[], random: Random): Promise<DuelRound | null> {
  const mass = DUEL_STATS.find((s) => s.key === 'massKg')!;
  const hasMass = Prisma.sql`"massKg" IS NOT NULL AND "massKg" > 0`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const a = await randomCarOf(tx, attempt < 4 ? rollRarity(false, random) : null, hasMass, used);
    if (!a) continue;
    const b = await randomCarOf(tx, attempt < 4 ? rollRarity(false, random) : null, hasMass, [...used, a.id]);
    if (!b || !mass.minGap(a.massKg!, b.massKg!)) continue;
    const aWins = a.massKg! > b.massKg!;
    return {
      stat: 'massKg',
      question: 'Laquelle est la plus lourde ?',
      a: gameCard(a),
      b: gameCard(b),
      answer: aWins ? 'a' : 'b',
      reveal: { a: mass.format(a.massKg!), b: mass.format(b.massKg!) },
      prizeCarId: aWins ? a.id : b.id,
    };
  }
  const fallback = await makeDuelRound(tx, used, random);
  if (!fallback) return null;
  return { ...fallback, prizeCarId: fallback.answer === 'a' ? fallback.a.id : fallback.b.id };
}

/**
 * Question pour une carte : la carte à gagner est visible, la difficulté de la question suit sa rareté.
 *  - Commune / Peu commune : le pays (la marque, visible, aide)
 *  - Rare : la décennie (4 décennies consécutives)
 *  - Épique / Légendaire : l'année exacte (4 années proches)
 */
export async function makeMysteryRound(tx: Tx, used: number[], random: Random): Promise<MysteryRound | null> {
  const rarity = rollRarity(false, random);
  const wanted: MysteryRound['kind'] = rarity === 'RARE' ? 'decade' : rarity === 'EPIC' || rarity === 'LEGENDARY' ? 'year' : 'country';
  const order: MysteryRound['kind'][] = wanted === 'country' ? ['country', 'decade'] : [wanted, 'decade', 'country'];

  for (const kind of order) {
    const cond = kind === 'country' ? Prisma.sql`"country" IS NOT NULL` : Prisma.sql`"yearStart" IS NOT NULL`;
    const car = (await randomCarOf(tx, rarity, cond, used)) ?? (await randomCarOf(tx, null, cond, used));
    if (!car) continue;

    let correct: string;
    let choices: string[];
    if (kind === 'country') {
      const others = await distinctValues(tx, 'country', car.country!, 3);
      if (others.length < 3) continue;
      correct = car.country!;
      choices = shuffleWith([correct, ...others], random);
    } else if (kind === 'decade') {
      const decade = Math.floor(car.yearStart! / 10) * 10;
      // 4 décennies consécutives, la bonne à une position aléatoire, bornées à 1880–2020.
      let first = decade - 10 * Math.floor(random() * 4);
      first = Math.min(Math.max(first, 1880), 2020 - 30);
      choices = [0, 1, 2, 3].map((i) => `Années ${first + i * 10}`);
      correct = `Années ${decade}`;
      if (!choices.includes(correct)) continue;
    } else {
      const y = car.yearStart!;
      const pool = shuffleWith([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].map((d) => y + d).filter((v) => v <= new Date().getFullYear()), random);
      correct = String(y);
      choices = [correct, ...pool.slice(0, 3).map(String)].sort();
    }
    const prompt =
      kind === 'country' ? 'De quel pays vient cette voiture ?' : kind === 'decade' ? 'En quelle décennie est-elle sortie ?' : 'En quelle année est-elle sortie ?';
    return { kind, prompt, card: gameCard(car), choices, answer: choices.indexOf(correct), carId: car.id, prizeCarId: car.id };
  }
  return null;
}

/** Trois portes : une vide, une carte standard (Commune / Peu commune), une haut de gamme (Épique / Légendaire). */
async function makeDoorsRound(tx: Tx, random: Random): Promise<DoorsRound | null> {
  const any = Prisma.sql`true`;
  const s = (await randomCarOf(tx, random() < 0.7 ? 'COMMON' : 'UNCOMMON', any, [])) ?? (await randomCarOf(tx, null, any, []));
  const top: Rarity = random() < 0.8 ? 'EPIC' : 'LEGENDARY';
  const t = s && ((await randomCarOf(tx, top, any, [s.id])) ?? (await randomCarOf(tx, top === 'EPIC' ? 'LEGENDARY' : 'EPIC', any, [s.id])));
  if (!s || !t) return null;
  const outcomes = shuffleWith<DoorsRound['outcomes'][number]>(
    [
      { tier: 'none', carId: null },
      { tier: 'standard', carId: s.id },
      { tier: 'top', carId: t.id },
    ],
    random,
  );
  return { kind: 'doors', prompt: 'Derrière quelle porte se cache la meilleure voiture ?', doors: 3, outcomes };
}
