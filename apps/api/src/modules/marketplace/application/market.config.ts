import { createHash } from 'node:crypto';
import { economyConfig } from '../../../config';
import { AuctionRules } from '../domain/auction';
import { TradeRules } from '../domain/trade-offer';

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
