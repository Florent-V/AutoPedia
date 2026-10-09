import { Rarity } from '@prisma/client';

export const RARITIES: Rarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

export interface RarityInfo {
  label: string;
  points: number;
  /** Part du catalogue dans cette rareté (classement par notoriété). */
  catalogShare: number;
  /** Probabilité de tirage pour un emplacement standard. */
  dropWeight: number;
  /** Probabilité de tirage pour le dernier emplacement (« carte vedette »). */
  featuredWeight: number;
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  COMMON: { label: 'Commune', points: 1, catalogShare: 0.5, dropWeight: 62, featuredWeight: 0 },
  UNCOMMON: { label: 'Peu commune', points: 3, catalogShare: 0.27, dropWeight: 26, featuredWeight: 55 },
  RARE: { label: 'Rare', points: 10, catalogShare: 0.15, dropWeight: 9, featuredWeight: 33 },
  EPIC: { label: 'Épique', points: 30, catalogShare: 0.06, dropWeight: 2.5, featuredWeight: 9.5 },
  LEGENDARY: { label: 'Légendaire', points: 100, catalogShare: 0.02, dropWeight: 0.5, featuredWeight: 2.5 },
};

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

/** Tire une rareté selon les poids donnés. `random` est injectable pour les tests. */
export function rollRarity(featured: boolean, random: () => number = Math.random): Rarity {
  const weights = RARITIES.map((r) => (featured ? RARITY_INFO[r].featuredWeight : RARITY_INFO[r].dropWeight));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = random() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll < 0) return RARITIES[i];
  }
  return RARITIES[RARITIES.length - 1];
}

/** Raretés de chaque emplacement d'un booster : le dernier est une carte « vedette » (peu commune ou mieux). */
export function rollBoosterRarities(count: number, random: () => number = Math.random): Rarity[] {
  return Array.from({ length: count }, (_, i) => rollRarity(i === count - 1, random));
}

/**
 * Attribue une rareté à chaque carte à partir de son classement de notoriété :
 * les 2 % les plus célèbres sont légendaires, les 6 % suivants épiques, etc.
 * `sortedIds` doit être trié du plus populaire au moins populaire.
 */
export function assignRarities<T>(sortedIds: T[]): Map<T, Rarity> {
  const result = new Map<T, Rarity>();
  const n = sortedIds.length;
  const order = [...RARITIES].reverse(); // LEGENDARY -> COMMON
  let cursor = 0;
  let cumulative = 0;
  for (const rarity of order) {
    cumulative += RARITY_INFO[rarity].catalogShare;
    const end = rarity === 'COMMON' ? n : Math.max(cursor + (n > 0 ? 1 : 0), Math.round(n * cumulative));
    for (; cursor < Math.min(end, n); cursor++) result.set(sortedIds[cursor], rarity);
  }
  return result;
}
