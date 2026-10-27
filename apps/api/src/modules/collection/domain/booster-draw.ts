import { Rarity, rollRarity } from '../../catalog/domain/rarity';

/** Composition d'un booster : un emplacement « vedette » (peu commune ou mieux) et les garanties. */

export interface Pity {
  /** Le booster doit contenir au moins une Épique (ou mieux). */
  epic?: boolean;
  /** Le booster doit contenir une Légendaire. */
  legendary?: boolean;
}

/**
 * Raretés de chaque emplacement d'un booster : le dernier est une carte « vedette » (peu commune ou mieux).
 * La garantie (pity) ne s'applique que si le tirage normal ne l'a pas déjà satisfaite.
 */
export function rollBoosterRarities(count: number, random: () => number = Math.random, pity: Pity = {}): Rarity[] {
  const slots = Array.from({ length: count }, (_, i) => rollRarity(i === count - 1, random));
  const last = count - 1;
  if (pity.legendary && !slots.includes('LEGENDARY')) {
    slots[last] = 'LEGENDARY';
  } else if (pity.epic && !slots.some((r) => r === 'EPIC' || r === 'LEGENDARY')) {
    slots[last] = random() < 0.2 ? 'LEGENDARY' : 'EPIC';
  }
  return slots;
}

/** Garantie à appliquer au prochain booster, d'après le nombre de boosters ouverts sans Épique / Légendaire. */
export function pityFor(sinceEpic: number, sinceLegendary: number, epicEvery: number, legendaryEvery: number): Pity {
  return { epic: sinceEpic + 1 >= epicEvery, legendary: sinceLegendary + 1 >= legendaryEvery };
}
