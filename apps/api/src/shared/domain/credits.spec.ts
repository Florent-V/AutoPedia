import { Credits } from './credits';
import { InvalidRequest, RuleViolation } from './errors';

describe('Credits', () => {
  it('refuse les montants négatifs, décimaux ou démesurés', () => {
    expect(() => Credits.of(-1)).toThrow(InvalidRequest);
    expect(() => Credits.of(1.5)).toThrow(InvalidRequest);
    expect(() => Credits.of(Number.NaN)).toThrow(InvalidRequest);
    expect(() => Credits.of(2_000_000_000)).toThrow(InvalidRequest);
    expect(() => Credits.of(10).add(0)).toThrow(InvalidRequest);
    expect(() => Credits.of(10).subtract(-5)).toThrow(InvalidRequest);
  });

  it('ne descend jamais sous zéro', () => {
    expect(Credits.of(10).subtract(10).value).toBe(0);
    expect(() => Credits.of(10).subtract(11)).toThrow(RuleViolation);
  });

  it('additionne sans dépasser le plafond', () => {
    expect(Credits.of(10).add(5).value).toBe(15);
    expect(() => Credits.of(999_999_999).add(2)).toThrow(RuleViolation);
  });
});
