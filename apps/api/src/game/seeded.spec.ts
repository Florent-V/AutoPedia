import { seededShuffle } from './seeded';

describe('seeded shuffle', () => {
  it('is deterministic and a permutation', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = seededShuffle(items, 'graine');
    expect(seededShuffle(items, 'graine')).toEqual(a);
    expect(seededShuffle(items, 'autre')).not.toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
