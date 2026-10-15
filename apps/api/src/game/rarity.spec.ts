import { assignRarities, pityFor, rollBoosterRarities, rollRarity } from './rarity';

describe('rarity', () => {
  it('assigns rarities by popularity rank', () => {
    const ids = Array.from({ length: 100 }, (_, i) => i);
    const map = assignRarities(ids);
    expect(map.get(0)).toBe('LEGENDARY');
    expect(map.get(1)).toBe('LEGENDARY');
    expect(map.get(2)).toBe('EPIC');
    expect(map.get(99)).toBe('COMMON');
    const counts: Record<string, number> = {};
    for (const r of map.values()) counts[r] = (counts[r] ?? 0) + 1;
    expect(counts).toEqual({ LEGENDARY: 2, EPIC: 6, RARE: 15, UNCOMMON: 27, COMMON: 50 });
  });

  it('gives at least one legendary on tiny catalogs', () => {
    const map = assignRarities(['a', 'b', 'c']);
    expect(map.get('a')).toBe('LEGENDARY');
    expect(map.size).toBe(3);
  });

  it('never rolls a common card in the featured slot', () => {
    for (let i = 0; i < 1000; i++) expect(rollRarity(true)).not.toBe('COMMON');
  });

  it('applies the epic pity when the roll has none', () => {
    const slots = rollBoosterRarities(5, () => 0.5, { epic: true });
    expect(['EPIC', 'LEGENDARY']).toContain(slots[4]);
  });

  it('applies the legendary pity', () => {
    expect(rollBoosterRarities(5, () => 0, { legendary: true, epic: true })[4]).toBe('LEGENDARY');
  });

  it('triggers pity on the Nth booster', () => {
    expect(pityFor(8, 0, 10, 60).epic).toBe(false);
    expect(pityFor(9, 59, 10, 60)).toEqual({ epic: true, legendary: true });
  });

  it('rolls the expected number of slots', () => {
    const slots = rollBoosterRarities(5, () => 0);
    expect(slots).toEqual(['COMMON', 'COMMON', 'COMMON', 'COMMON', 'UNCOMMON']);
  });
});
