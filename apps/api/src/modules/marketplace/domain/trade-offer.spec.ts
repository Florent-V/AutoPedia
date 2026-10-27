import { Forbidden, InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { TradeOffer, TradeRules } from './trade-offer';

const rules: TradeRules = { durationDays: 7, maxPrice: 1_000_000 };
const t0 = new Date('2026-06-01T12:00:00Z');
const create = (p: { wantedCarId?: number; price?: number }) => TradeOffer.create({ id: 't', sellerId: 's', offeredCarId: 1, now: t0, rules, ...p });

describe('TradeOffer', () => {
  it('exige une seule contrepartie valide', () => {
    expect(() => create({})).toThrow(InvalidRequest);
    expect(() => create({ wantedCarId: 2, price: 10 })).toThrow(InvalidRequest);
    expect(() => create({ wantedCarId: 1 })).toThrow(InvalidRequest);
    for (const price of [0, -5, 1.5, 2_000_000]) expect(() => create({ price })).toThrow(InvalidRequest);
    expect(create({ price: 10 }).snapshot().expiresAt).toEqual(new Date(t0.getTime() + 7 * 86_400_000));
  });

  it('ne s’accepte qu’une fois, par un autre joueur, avant expiration', () => {
    expect(() => create({ price: 10 }).accept('s', t0)).toThrow(InvalidRequest);
    expect(() => create({ price: 10 }).accept('b', new Date(t0.getTime() + 8 * 86_400_000))).toThrow(RuleViolation);
    const o = create({ price: 10 });
    o.accept('b', t0);
    expect(() => o.accept('c', t0)).toThrow(RuleViolation);
    expect(() => o.cancel('s', t0)).toThrow(RuleViolation);
  });

  it('seul le vendeur retire son offre', () => {
    expect(() => create({ price: 10 }).cancel('b', t0)).toThrow(Forbidden);
    const o = create({ price: 10 });
    o.cancel('s', t0);
    expect(o.snapshot().status).toBe('CANCELLED');
  });
});
