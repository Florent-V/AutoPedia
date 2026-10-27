import { RuleViolation } from '../../../shared/domain/errors';
import { Rarity, rarityRank, RARITY_INFO } from '../../catalog/domain/rarity';

/**
 * Garde-fous contre les comptes multiples : sans eux, on pourrait créer des comptes jetables,
 * récupérer leurs boosters et crédits de bienvenue, puis tout transférer vers son compte principal
 * (carte vendue 1 crédit, Légendaire échangée contre une Commune, enchère gonflée…).
 */
export interface MarketPolicy {
  /** Ancienneté minimale du compte pour accéder à la bourse et aux enchères. */
  minAccountHours: number;
  /** Boosters ouverts au minimum (un compte doit avoir réellement joué). */
  minBoostersOpened: number;
  /** Écart maximal de rareté pour un échange carte contre carte (0 = même rareté). */
  maxSwapRarityGap: number;
  /** Prix minimal en crédits, par rareté (vente à la bourse, prix de départ d'une enchère). */
  priceFloor: Record<Rarity, number>;
}

export interface TraderProfile {
  accountCreatedAt: Date;
  boostersOpened: number;
  isBot: boolean;
}

/** Le joueur peut-il utiliser la bourse et les enchères ? (les bots, pilotés par le serveur, sont exemptés) */
export function assertCanTrade(trader: TraderProfile, now: Date, policy: MarketPolicy) {
  if (trader.isBot) return;
  const readyAt = new Date(trader.accountCreatedAt.getTime() + policy.minAccountHours * 3600 * 1000);
  if (readyAt > now) {
    const hours = Math.ceil((readyAt.getTime() - now.getTime()) / 3600_000);
    throw new RuleViolation(`Le marché s’ouvre aux nouveaux comptes après ${policy.minAccountHours} h : encore ${hours} h à patienter`);
  }
  if (trader.boostersOpened < policy.minBoostersOpened) {
    throw new RuleViolation(`Ouvrez au moins ${policy.minBoostersOpened} boosters avant d’accéder au marché`);
  }
}

export function assertPriceFloor(rarity: Rarity, price: number, policy: MarketPolicy) {
  const floor = policy.priceFloor[rarity];
  if (price < floor) {
    throw new RuleViolation(`Prix trop bas : au moins ${floor} crédits pour une carte ${RARITY_INFO[rarity].label.toLowerCase()}`);
  }
}

export function assertFairSwap(offered: Rarity, wanted: Rarity, policy: MarketPolicy) {
  if (Math.abs(rarityRank(offered) - rarityRank(wanted)) > policy.maxSwapRarityGap) {
    throw new RuleViolation('Échange refusé : les deux cartes doivent être de raretés proches');
  }
}
