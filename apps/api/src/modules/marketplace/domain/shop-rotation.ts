import { RARITIES, Rarity } from '../../catalog/domain/rarity';
import { seededRandom, seededShuffle } from '../../../shared/domain/seeded';

export interface ShopSlotRule {
  /** Offres de cette rareté présentées à chaque rotation. */
  perRotation: number;
  /** Une rotation toutes les N heures (les légendaires tournent moins souvent). */
  everyHours: number;
  price: number;
}

export const SHOP_RULES: Record<Rarity, ShopSlotRule> = {
  COMMON: { perRotation: 3, everyHours: 1, price: 40 },
  UNCOMMON: { perRotation: 2, everyHours: 1, price: 120 },
  RARE: { perRotation: 2, everyHours: 1, price: 400 },
  EPIC: { perRotation: 1, everyHours: 2, price: 1200 },
  LEGENDARY: { perRotation: 1, everyHours: 4, price: 4000 },
};

/** Réduction appliquée à « l'affaire de l'heure ». */
export const DEAL_DISCOUNT = 0.25;

export interface ShopOffer {
  offerKey: string;
  rarity: Rarity;
  carId: number;
  price: number;
  basePrice: number;
  deal: boolean;
  /** Heure (dans la journée) à laquelle l'offre disparaît. */
  untilHour: number;
}

/**
 * Programme du jour pour une rareté : ordre déterministe (graine secrète + date) de toutes les cartes de cette rareté.
 * Les rotations successives de la journée parcourent cet ordre, donc une carte n'apparaît qu'une fois par jour
 * (sauf si la rareté compte moins de cartes que de places dans la journée).
 */
export function dailyProgramme(ids: number[], secret: string, date: string, rarity: Rarity): number[] {
  return seededShuffle([...ids].sort((a, b) => a - b), `${secret}:${date}:${rarity}`);
}

/** Offres visibles à une heure donnée. */
export function offersAt(poolByRarity: Partial<Record<Rarity, number[]>>, secret: string, date: string, hour: number): ShopOffer[] {
  const offers: ShopOffer[] = [];
  for (const rarity of RARITIES) {
    const rule = SHOP_RULES[rarity];
    const programme = dailyProgramme(poolByRarity[rarity] ?? [], secret, date, rarity);
    if (!programme.length) continue;
    const rotation = Math.floor(hour / rule.everyHours);
    const seen = new Set<number>();
    for (let i = 0; i < rule.perRotation; i++) {
      const carId = programme[(rotation * rule.perRotation + i) % programme.length];
      if (seen.has(carId)) continue;
      seen.add(carId);
      offers.push({
        offerKey: `${date}T${String(rotation * rule.everyHours).padStart(2, '0')}:${rarity}:${i}`,
        rarity,
        carId,
        price: rule.price,
        basePrice: rule.price,
        deal: false,
        untilHour: Math.min(24, (rotation + 1) * rule.everyHours),
      });
    }
  }
  if (offers.length) {
    const deal = offers[Math.floor(seededRandom(`${secret}:${date}:${hour}:deal`)() * offers.length)];
    deal.deal = true;
    deal.price = Math.round(deal.basePrice * (1 - DEAL_DISCOUNT));
  }
  return offers;
}
