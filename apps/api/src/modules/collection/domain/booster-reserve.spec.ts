import { RuleViolation } from '../../../shared/domain/errors';
import { BoosterReserve, BoosterRules } from './booster-reserve';

const rules: BoosterRules = { max: 10, regenMs: 30 * 60_000, cardsPerBooster: 5, pityEpic: 10, pityLegendary: 60 };
const t0 = new Date('2026-01-01T12:00:00Z');
const reserve = (boosters: number, extra: Partial<{ sinceEpic: number; sinceLegendary: number }> = {}) =>
  BoosterReserve.restore({ userId: 'u', boosters, anchor: t0, boostersOpened: 0, cardsObtained: 0, sinceEpic: 0, sinceLegendary: 0, ...extra });

describe('BoosterReserve', () => {
  it('refuse d’ouvrir une réserve vide', () => {
    expect(() => reserve(0).consume(t0, rules)).toThrow(RuleViolation);
  });

  it('régénère avant de consommer', () => {
    const r = reserve(0);
    const after = r.consume(new Date(t0.getTime() + rules.regenMs), rules);
    expect(after.boosters).toBe(0);
  });

  it('met à jour les garanties selon le contenu', () => {
    const r = reserve(5, { sinceEpic: 9, sinceLegendary: 59 });
    expect(r.pity(rules)).toEqual({ epic: true, legendary: true });
    r.recordOpening(['COMMON', 'EPIC']);
    expect(r.snapshot()).toMatchObject({ sinceEpic: 0, sinceLegendary: 60, boostersOpened: 1, cardsObtained: 2 });
    r.recordOpening(['LEGENDARY']);
    expect(r.snapshot()).toMatchObject({ sinceEpic: 0, sinceLegendary: 0 });
  });

  it('peut dépasser le maximum avec des boosters offerts', () => {
    const r = reserve(10);
    expect(r.grant(3, t0, rules).boosters).toBe(13);
    expect(() => r.grant(0, t0, rules)).toThrow();
    expect(() => r.grant(-2, t0, rules)).toThrow();
  });
});
