import { Forbidden, InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { Auction, AuctionRules, minBid } from './auction';

const rules: AuctionRules = { durationsHours: [1, 3, 6, 12, 24], maxStartPrice: 1_000_000, maxBid: 10_000_000, feePercent: 5, snipeSeconds: 120 };
const t0 = new Date('2026-06-01T12:00:00Z');
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
const open = (startPrice = 20) => Auction.open({ id: 'a', sellerId: 'seller', carId: 1, startPrice, durationHours: 1, now: t0, rules });

describe('Auction', () => {
  it('valide la mise en vente', () => {
    expect(() => Auction.open({ id: 'a', sellerId: 's', carId: 1, startPrice: 5, durationHours: 2, now: t0, rules })).toThrow(InvalidRequest);
    for (const startPrice of [0, -3, 1.5, 2_000_000]) {
      expect(() => Auction.open({ id: 'a', sellerId: 's', carId: 1, startPrice, durationHours: 1, now: t0, rules })).toThrow(InvalidRequest);
    }
  });

  it('impose l’offre minimale et rend la main au précédent enchérisseur', () => {
    const a = open();
    expect(() => a.bid('seller', 50, at(1), rules)).toThrow(InvalidRequest);
    expect(() => a.bid('b1', 19, at(1), rules)).toThrow(InvalidRequest);
    expect(a.bid('b1', 20, at(1), rules)).toEqual({ previous: null });
    expect(() => a.bid('b1', 40, at(2), rules)).toThrow(RuleViolation);
    expect(minBid(a.snapshot())).toBe(21);
    expect(() => a.bid('b2', 20, at(2), rules)).toThrow(InvalidRequest);
    expect(a.bid('b2', 21, at(2), rules)).toEqual({ previous: { userId: 'b1', amount: 20 } });
    for (const amount of [0, -1, 2.5, Number.NaN, 20_000_000]) expect(() => a.bid('b3', amount, at(3), rules)).toThrow(InvalidRequest);
  });

  it('prolonge une enchère qui reçoit une offre dans les 2 dernières minutes', () => {
    const a = open();
    a.bid('b1', 20, at(3600 - 30), rules);
    expect(a.endsAt).toEqual(at(3600 - 30 + 120));
    expect(() => a.bid('b2', 30, at(3600 + 200), rules)).toThrow(RuleViolation);
  });

  it('ne s’annule que par le vendeur, sans offre', () => {
    expect(() => open().cancel('autre', t0)).toThrow(Forbidden);
    const a = open();
    a.bid('b1', 20, at(1), rules);
    expect(() => a.cancel('seller', at(2))).toThrow(RuleViolation);
  });

  it('se règle à l’échéance : commission retenue sur le prix', () => {
    const a = open();
    a.bid('b1', 25, at(10), rules);
    expect(() => a.settle(at(100), rules)).toThrow(RuleViolation);
    expect(a.settle(at(3600), rules)).toEqual({ outcome: 'SOLD', sellerId: 'seller', buyerId: 'b1', carId: 1, price: 25, fee: 1, sellerProceeds: 24 });
    expect(() => a.settle(at(3601), rules)).toThrow(RuleViolation);
    expect(open().settle(at(3600), rules)).toEqual({ outcome: 'UNSOLD', sellerId: 'seller', carId: 1 });
  });
});
