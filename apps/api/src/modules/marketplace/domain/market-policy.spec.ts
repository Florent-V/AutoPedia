import { RuleViolation } from '../../../shared/domain/errors';
import { assertCanTrade, assertFairSwap, assertPriceFloor, MarketPolicy } from './market-policy';

const policy: MarketPolicy = {
  minAccountHours: 24,
  minBoostersOpened: 3,
  maxSwapRarityGap: 1,
  priceFloor: { COMMON: 5, UNCOMMON: 15, RARE: 50, EPIC: 150, LEGENDARY: 500 },
};
const now = new Date('2026-06-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

describe('MarketPolicy', () => {
  it('ferme le marché aux comptes trop récents ou inactifs, sauf aux bots', () => {
    expect(() => assertCanTrade({ accountCreatedAt: hoursAgo(2), boostersOpened: 10, isBot: false }, now, policy)).toThrow(RuleViolation);
    expect(() => assertCanTrade({ accountCreatedAt: hoursAgo(48), boostersOpened: 2, isBot: false }, now, policy)).toThrow(RuleViolation);
    expect(() => assertCanTrade({ accountCreatedAt: hoursAgo(48), boostersOpened: 3, isBot: false }, now, policy)).not.toThrow();
    expect(() => assertCanTrade({ accountCreatedAt: hoursAgo(0), boostersOpened: 0, isBot: true }, now, policy)).not.toThrow();
  });

  it('impose un prix plancher selon la rareté', () => {
    expect(() => assertPriceFloor('LEGENDARY', 1, policy)).toThrow(RuleViolation);
    expect(() => assertPriceFloor('LEGENDARY', 500, policy)).not.toThrow();
    expect(() => assertPriceFloor('COMMON', 5, policy)).not.toThrow();
  });

  it('refuse les échanges trop déséquilibrés', () => {
    expect(() => assertFairSwap('LEGENDARY', 'COMMON', policy)).toThrow(RuleViolation);
    expect(() => assertFairSwap('RARE', 'EPIC', policy)).not.toThrow();
    expect(() => assertFairSwap('UNCOMMON', 'UNCOMMON', policy)).not.toThrow();
  });
});
