import { assignRarities, nearestRarities, rollRarity } from './rarity';

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

  it('falls back to the nearest rarity first', () => {
    expect(nearestRarities('RARE')).toEqual(['RARE', 'UNCOMMON', 'EPIC', 'COMMON', 'LEGENDARY']);
    expect(nearestRarities('LEGENDARY')).toEqual(['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']);
  });

  it('never rolls a common card in the featured slot', () => {
    for (let i = 0; i < 1000; i++) expect(rollRarity(true)).not.toBe('COMMON');
  });

});
