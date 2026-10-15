import { Car, Prisma } from '@prisma/client';
import { imageUrlOf } from '../cars/card.dto';

type Tx = Prisma.TransactionClient;

/** Carte réduite envoyée pendant un jeu : jamais les valeurs qui donneraient la réponse. */
export function gameCard(car: Car) {
  return {
    id: car.id,
    name: car.name,
    manufacturer: car.manufacturer,
    imageUrl: imageUrlOf(car),
    rarity: car.rarityOverride ?? car.rarity,
  };
}

// ---------------------------------------------------------------------------
// Duel de stats
// ---------------------------------------------------------------------------

export interface DuelStat {
  key: 'topSpeedKmh' | 'massKg' | 'lengthMm' | 'powerKw' | 'yearStart' | 'popularity';
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

export interface DuelRound {
  stat: DuelStat['key'];
  question: string;
  a: ReturnType<typeof gameCard>;
  b: ReturnType<typeof gameCard>;
  answer: 'a' | 'b';
  reveal: { a: string; b: string };
}

export async function makeDuelRound(tx: Tx, used: number[]): Promise<DuelRound | null> {
  const stats = [...DUEL_STATS].sort(() => Math.random() - 0.5);
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

export type QuizKind = 'brand' | 'country' | 'decade' | 'photo';

export interface QuizRound {
  kind: QuizKind;
  prompt: string;
  car: { name: string | null; imageUrl: string | null };
  choices: string[];
  answer: number;
  carId: number;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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

function build(kind: QuizKind, prompt: string, car: Car, correct: string, others: string[], showName = true): QuizRound | null {
  if (others.length < 3) return null;
  const choices = shuffle([correct, ...others.slice(0, 3)]);
  return {
    kind,
    prompt,
    car: { name: showName ? car.name : null, imageUrl: imageUrlOf(car) },
    choices,
    answer: choices.indexOf(correct),
    carId: car.id,
  };
}

export async function makeQuizRound(tx: Tx, used: number[]): Promise<QuizRound | null> {
  const kinds = shuffle<QuizKind>(['brand', 'country', 'decade', 'photo']);
  for (const kind of kinds) {
    if (kind === 'brand') {
      const car = await randomCar(tx, Prisma.sql`"manufacturer" IS NOT NULL`, used);
      if (!car) continue;
      const q = build('brand', `Quelle marque produit la « ${car.name} » ?`, car, car.manufacturer!, await distinctValues(tx, 'manufacturer', car.manufacturer!, 3));
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
      const q = build('country', `De quel pays vient la « ${car.name} » ?`, car, car.country!, await distinctValues(tx, 'country', car.country!, 3));
      if (q) return q;
    }
    if (kind === 'decade') {
      const car = await randomCar(tx, Prisma.sql`"yearStart" IS NOT NULL`, used);
      if (!car) continue;
      const decade = Math.floor(car.yearStart! / 10) * 10;
      const candidates = [-30, -20, -10, 10, 20, 30].map((d) => decade + d).filter((d) => d >= 1880 && d <= 2030);
      const others = shuffle(candidates).slice(0, 3);
      const q = build('decade', `En quelle décennie la « ${car.name} » est-elle sortie ?`, car, `Années ${decade}`, others.map((d) => `Années ${d}`));
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
      const q = build('photo', 'Quel est ce modèle ?', car, car.name, rows.map((r) => r.name), false);
      if (q) return q;
    }
  }
  return null;
}
