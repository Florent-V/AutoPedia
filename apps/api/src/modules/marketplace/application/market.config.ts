import { createHash } from 'node:crypto';
import { economyConfig } from '../../../config';
import { AuctionRules } from '../domain/auction';
import { MarketPolicy } from '../domain/market-policy';
import { TradeRules } from '../domain/trade-offer';

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

export const tradeRules: TradeRules = { durationDays: economyConfig.tradeDays, maxPrice: 1_000_000 };

export const auctionRules: AuctionRules = {
  durationsHours: economyConfig.auctionDurations,
  maxStartPrice: 1_000_000,
  maxBid: 10_000_000,
  feePercent: economyConfig.auctionFeePercent,
  snipeSeconds: economyConfig.auctionSnipeSeconds,
};

/** Graine secrète de la boutique : empêche de calculer à l'avance le programme des jours suivants. */
export const SHOP_SECRET =
  process.env.SHOP_SECRET ??
  createHash('sha256')
    .update(`shop:${process.env.BETTER_AUTH_SECRET ?? 'dev'}`)
    .digest('hex');

/** Garde-fous contre les comptes multiples (voir market-policy.ts). */
export const marketPolicy: MarketPolicy = {
  minAccountHours: num('MARKET_MIN_ACCOUNT_HOURS', 24),
  minBoostersOpened: num('MARKET_MIN_BOOSTERS', 3),
  maxSwapRarityGap: num('TRADE_MAX_RARITY_GAP', 1),
  priceFloor: { COMMON: 5, UNCOMMON: 15, RARE: 50, EPIC: 150, LEGENDARY: 500 },
};
