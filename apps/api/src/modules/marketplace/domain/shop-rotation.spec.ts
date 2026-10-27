import { offersAt, SHOP_RULES } from './shop-rotation';

const pool = {
  COMMON: Array.from({ length: 200 }, (_, i) => i + 1),
  UNCOMMON: Array.from({ length: 100 }, (_, i) => 1000 + i),
  RARE: Array.from({ length: 50 }, (_, i) => 2000 + i),
  EPIC: Array.from({ length: 20 }, (_, i) => 3000 + i),
  LEGENDARY: Array.from({ length: 6 }, (_, i) => 4000 + i),
};

describe('shop rotation', () => {
  it('is stable within an hour and changes the next hour', () => {
    const a = offersAt(pool, 's', '2026-10-15', 14);
    expect(offersAt(pool, 's', '2026-10-15', 14)).toEqual(a);
    const b = offersAt(pool, 's', '2026-10-15', 15);
    expect(b.filter((o) => o.rarity === 'COMMON').map((o) => o.carId)).not.toEqual(
      a.filter((o) => o.rarity === 'COMMON').map((o) => o.carId),
    );
  });

  it('never repeats a common card within a day', () => {
    const ids = Array.from({ length: 24 }, (_, h) => offersAt(pool, 's', '2026-10-15', h))
      .flat()
      .filter((o) => o.rarity === 'COMMON')
      .map((o) => o.carId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps legendary offers for 4 hours with a shared key', () => {
    const at = (h: number) => offersAt(pool, 's', '2026-10-15', h).find((o) => o.rarity === 'LEGENDARY')!;
    expect(at(8).offerKey).toBe(at(11).offerKey);
    expect(at(8).untilHour).toBe(12);
    expect(at(12).offerKey).not.toBe(at(11).offerKey);
  });

  it('applies exactly one deal per hour', () => {
    const offers = offersAt(pool, 's', '2026-10-15', 9);
    const deals = offers.filter((o) => o.deal);
    expect(deals).toHaveLength(1);
    expect(deals[0].price).toBeLessThan(SHOP_RULES[deals[0].rarity].price);
  });
});
