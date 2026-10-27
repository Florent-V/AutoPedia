import { pityFor, rollBoosterRarities } from './booster-draw';

describe('booster draw', () => {
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
