import { acceptsPriceOffer, acceptsSwap, botValuation, BotProfile, decideBid, REF_VALUE, STYLE_PRESETS } from './bot-brain';

const profile = (style: BotProfile['style'], extra: Partial<BotProfile> = {}): BotProfile => ({
  style,
  activityMinutes: 20,
  favoriteBrand: null,
  likesRacing: false,
  ...STYLE_PRESETS[style],
  ...extra,
});
const half = () => 0.5;

describe('bot brain', () => {
  it('values missing cards more than duplicates', () => {
    const p = profile('collectionneur');
    const card = { rarity: 'RARE' as const, manufacturer: 'Ferrari', racing: false };
    expect(botValuation(p, card, 0, half)).toBeGreaterThan(botValuation(p, card, 1, half));
    expect(botValuation(p, card, 1, half)).toBeGreaterThan(botValuation(p, card, 3, half));
  });

  it('pays a premium for its favourite brand', () => {
    const p = profile('passionne', { favoriteBrand: 'Porsche' });
    const fav = botValuation(p, { rarity: 'EPIC', manufacturer: 'Porsche', racing: false }, 0, half);
    const other = botValuation(p, { rarity: 'EPIC', manufacturer: 'Fiat', racing: false }, 0, half);
    expect(fav / other).toBeCloseTo(1.8, 1);
  });

  it('never bids above its valuation', () => {
    const p = profile('marchand');
    expect(decideBid(p, 100, 150, 3600_000, false, () => 0)).toBeNull();
    for (let i = 0; i < 200; i++) {
      const bid = decideBid(p, 500, 300, 3600_000, false);
      if (bid !== null) expect(bid).toBeLessThanOrEqual(500);
      if (bid !== null) expect(bid).toBeGreaterThanOrEqual(300);
    }
  });

  it('does not always bid', () => {
    const p = profile('econome');
    const bids = Array.from({ length: 1000 }, () => decideBid(p, 1000, 900, 3600_000, false)).filter((b) => b !== null);
    expect(bids.length).toBeGreaterThan(100);
    expect(bids.length).toBeLessThan(700);
  });

  it('accepts only fair trades', () => {
    const p = profile('marchand');
    expect(acceptsPriceOffer(p, 100, 95, () => 0)).toBe(false);
    expect(acceptsPriceOffer(p, 100, 80, () => 0)).toBe(true);
    expect(acceptsSwap(p, REF_VALUE.EPIC, REF_VALUE.RARE, 1, () => 0)).toBe(false); // garde son dernier exemplaire
    expect(acceptsSwap(p, REF_VALUE.EPIC, REF_VALUE.RARE, 2, () => 0)).toBe(true);
    expect(acceptsSwap(p, REF_VALUE.COMMON, REF_VALUE.RARE, 5, () => 0)).toBe(false);
  });
});
