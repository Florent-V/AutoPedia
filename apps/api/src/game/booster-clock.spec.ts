import { computeBoosters, consumeBooster } from './booster-clock';

const MIN = 60_000;
const t0 = new Date('2026-01-01T00:00:00Z');
const at = (minutes: number) => new Date(t0.getTime() + minutes * MIN);

describe('booster clock', () => {
  it('regenerates one booster per interval', () => {
    const s = computeBoosters({ boosters: 2, anchor: t0 }, at(65), 10, 30 * MIN);
    expect(s.boosters).toBe(4);
    expect(s.anchor).toEqual(at(60));
    expect(s.nextAt).toEqual(at(90));
  });

  it('caps at max and freezes the timer', () => {
    const s = computeBoosters({ boosters: 8, anchor: t0 }, at(500), 10, 30 * MIN);
    expect(s.boosters).toBe(10);
    expect(s.nextAt).toBeNull();
  });

  it('starts the timer when opening from a full stock', () => {
    const full = computeBoosters({ boosters: 10, anchor: t0 }, at(100), 10, 30 * MIN);
    const after = consumeBooster(full, at(100));
    expect(after.boosters).toBe(9);
    expect(after.nextAt).toEqual(at(130));
  });

  it('keeps the running timer when not full', () => {
    const s = computeBoosters({ boosters: 5, anchor: t0 }, at(10), 10, 30 * MIN);
    const after = consumeBooster(s, at(10));
    expect(after.boosters).toBe(4);
    expect(after.nextAt).toEqual(at(30));
  });

  it('refuses to open without boosters', () => {
    const s = computeBoosters({ boosters: 0, anchor: t0 }, at(10), 10, 30 * MIN);
    expect(() => consumeBooster(s, at(10))).toThrow();
  });
});
