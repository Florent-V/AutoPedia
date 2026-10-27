import { RuleViolation } from '../../../shared/domain/errors';
import { DailyStreak } from './daily-streak';

const streak = (n: number, lastClaim: string | null) => DailyStreak.restore({ userId: 'u', streak: n, best: n, lastClaim });

describe('DailyStreak', () => {
  it('une seule réclamation par jour', () => {
    const s = streak(0, null);
    expect(s.claim('2026-03-02', '2026-03-01').day).toBe(1);
    expect(() => s.claim('2026-03-02', '2026-03-01')).toThrow(RuleViolation);
  });

  it('continue la série le lendemain et boucle après 7 jours', () => {
    expect(streak(6, '2026-03-01').claim('2026-03-02', '2026-03-01')).toMatchObject({ day: 7, topCard: true });
    expect(streak(7, '2026-03-01').claim('2026-03-02', '2026-03-01').day).toBe(1);
  });

  it('repart à 1 après un jour manqué, en gardant la meilleure série', () => {
    const s = streak(5, '2026-02-27');
    expect(s.status('2026-03-02', '2026-03-01')).toMatchObject({ streak: 0, day: 1, canClaim: true });
    expect(s.claim('2026-03-02', '2026-03-01').day).toBe(1);
    expect(s.snapshot()).toMatchObject({ streak: 1, best: 5 });
  });
});
