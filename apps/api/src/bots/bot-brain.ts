import { Rarity } from '@prisma/client';

/**
 * « Cerveau » des bots : fonctions pures (testables) qui estiment la valeur d'une carte
 * et décident d'enchérir, d'accepter un échange ou de vendre. Le hasard est injectable.
 */

export type BotStyle = 'collectionneur' | 'marchand' | 'econome' | 'passionne';

export interface BotProfile {
  style: BotStyle;
  /** Délai moyen entre deux passages du bot (minutes). */
  activityMinutes: number;
  /** Probabilité de base d'enchérir quand l'affaire est intéressante. */
  bidChance: number;
  /** Multiplicateur général de ce qu'il accepte de payer. */
  generosity: number;
  /** Bonus de valeur pour une carte qu'il n'a pas encore. */
  wantMissing: number;
  /** Probabilité de mettre un doublon en vente à chaque passage. */
  sellChance: number;
  favoriteBrand: string | null;
  likesRacing: boolean;
}

export const STYLE_PRESETS: Record<BotStyle, Omit<BotProfile, 'style' | 'activityMinutes' | 'favoriteBrand' | 'likesRacing'>> = {
  collectionneur: { bidChance: 0.55, generosity: 1.0, wantMissing: 1.45, sellChance: 0.15 },
  marchand: { bidChance: 0.7, generosity: 0.75, wantMissing: 1.0, sellChance: 0.5 },
  econome: { bidChance: 0.35, generosity: 0.6, wantMissing: 1.1, sellChance: 0.25 },
  passionne: { bidChance: 0.45, generosity: 1.15, wantMissing: 1.3, sellChance: 0.2 },
};

/** Valeur de référence d'une carte par rareté (alignée sur les prix de la boutique). */
export const REF_VALUE: Record<Rarity, number> = { COMMON: 40, UNCOMMON: 120, RARE: 400, EPIC: 1200, LEGENDARY: 4000 };

export interface CardFacts {
  rarity: Rarity;
  manufacturer: string | null;
  racing: boolean;
}

/** Combien ce bot est prêt à payer pour cette carte, compte tenu de ce qu'il possède déjà. */
export function botValuation(profile: BotProfile, card: CardFacts, ownedQty: number, random: () => number = Math.random): number {
  let v = REF_VALUE[card.rarity];
  v *= ownedQty === 0 ? profile.wantMissing : ownedQty === 1 ? 0.7 : 0.4;
  if (profile.favoriteBrand && card.manufacturer === profile.favoriteBrand) v *= profile.style === 'passionne' ? 1.8 : 1.3;
  if (profile.likesRacing && card.racing) v *= 1.3;
  v *= profile.generosity;
  v *= 0.85 + random() * 0.3; // humeur du moment
  return Math.max(1, Math.round(v));
}

/**
 * Décide d'une enchère : null pour passer son tour, sinon le montant proposé.
 * Le bot n'enchérit jamais au-delà de sa valeur estimée, et pas systématiquement :
 * plus l'affaire est bonne ou la fin proche, plus il est tenté.
 */
export function decideBid(
  profile: BotProfile,
  valuation: number,
  min: number,
  msLeft: number,
  sellerIsBot: boolean,
  random: () => number = Math.random,
): number | null {
  if (min > valuation) return null;
  let chance = profile.bidChance;
  if (msLeft < 15 * 60 * 1000) chance *= 1.5;
  if (min < valuation * 0.6) chance *= 1.3;
  if (sellerIsBot) chance *= 0.4; // les bots animent surtout le marché des joueurs
  if (random() > Math.min(0.95, chance)) return null;
  const step = Math.round(min * random() * 0.12);
  return Math.min(valuation, min + step);
}

/** Accepter une offre de la bourse contre des crédits ? */
export function acceptsPriceOffer(profile: BotProfile, valuation: number, price: number, random: () => number = Math.random) {
  return price <= valuation * 0.9 && random() < profile.bidChance;
}

/** Accepter un échange carte contre carte ? (il doit garder au moins un exemplaire de la carte demandée) */
export function acceptsSwap(
  profile: BotProfile,
  offeredValue: number,
  wantedValue: number,
  wantedQty: number,
  random: () => number = Math.random,
) {
  return wantedQty >= 2 && offeredValue >= wantedValue * 0.9 && random() < profile.bidChance;
}

/** Prix de départ d'une enchère mise en vente par un bot (une affaire possible pour les joueurs). */
export function auctionStartPrice(card: CardFacts, random: () => number = Math.random) {
  return Math.max(5, Math.round(REF_VALUE[card.rarity] * (0.3 + random() * 0.3)));
}

/** Prix demandé à la bourse par un bot. */
export function tradeAskPrice(profile: BotProfile, card: CardFacts, random: () => number = Math.random) {
  const greed = profile.style === 'marchand' ? 1.1 : 0.85;
  return Math.max(5, Math.round(REF_VALUE[card.rarity] * greed * (0.85 + random() * 0.3)));
}

/** Pseudos des bots (inventés). */
export const BOT_NAMES = [
  'Turbo_Lulu',
  'Mécano76',
  'GTI_Forever',
  'Rallye_Max',
  'Carbu_Claire',
  'V8_Vince',
  'Alpine_Anna',
  'Drift_Kiki',
  'Youngtimer_Yan',
  'Stratos_83',
  'Rotary_Rémi',
  'Panda4x4',
  'Boxer_Flat6',
  'Diesel_Dan',
  'La_Coccinelle',
  'PistonsEtPaillettes',
];
