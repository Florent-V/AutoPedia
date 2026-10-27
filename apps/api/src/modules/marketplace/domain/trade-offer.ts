import { Forbidden, InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { positiveInt } from '../../../shared/domain/guards';

export type TradeStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';

export interface TradeOfferSnapshot {
  id: string;
  sellerId: string;
  offeredCarId: number;
  wantedCarId: number | null;
  price: number | null;
  status: TradeStatus;
  buyerId: string | null;
  createdAt: Date;
  expiresAt: Date;
  closedAt: Date | null;
}

export interface TradeRules {
  durationDays: number;
  maxPrice: number;
}

/**
 * Offre de la bourse : une carte (mise sous séquestre) contre une autre carte ou contre des crédits.
 * Le prix et la carte demandée sont fixés à la création ; l'acheteur n'envoie que son acceptation.
 */
export class TradeOffer {
  private constructor(private s: TradeOfferSnapshot) {}

  static create(params: {
    id: string;
    sellerId: string;
    offeredCarId: number;
    wantedCarId?: number | null;
    price?: number | null;
    now: Date;
    rules: TradeRules;
  }) {
    const wanted = params.wantedCarId ?? null;
    const price = params.price ?? null;
    if ((wanted === null) === (price === null)) {
      throw new InvalidRequest('Indiquez soit une carte demandée en échange, soit un prix en crédits');
    }
    positiveInt(params.offeredCarId, 'Carte proposée');
    if (wanted !== null) positiveInt(wanted, 'Carte demandée');
    if (price !== null) positiveInt(price, 'Prix', params.rules.maxPrice);
    if (wanted === params.offeredCarId) throw new InvalidRequest('Impossible d’échanger une carte contre elle-même');
    return new TradeOffer({
      id: params.id,
      sellerId: params.sellerId,
      offeredCarId: params.offeredCarId,
      wantedCarId: wanted,
      price,
      status: 'OPEN',
      buyerId: null,
      createdAt: params.now,
      expiresAt: new Date(params.now.getTime() + params.rules.durationDays * 24 * 3600 * 1000),
      closedAt: null,
    });
  }

  static restore(snapshot: TradeOfferSnapshot) {
    return new TradeOffer({ ...snapshot });
  }

  snapshot(): TradeOfferSnapshot {
    return { ...this.s };
  }

  get id() {
    return this.s.id;
  }
  get sellerId() {
    return this.s.sellerId;
  }
  get offeredCarId() {
    return this.s.offeredCarId;
  }
  get wantedCarId() {
    return this.s.wantedCarId;
  }
  get price() {
    return this.s.price;
  }

  private assertOpen() {
    if (this.s.status !== 'OPEN') throw new RuleViolation('Cette offre n’est plus disponible');
  }

  isExpired(now: Date) {
    return this.s.expiresAt <= now;
  }

  /** L'acheteur accepte : contreparties (carte demandée ou prix) réglées par le cas d'usage. */
  accept(buyerId: string, now: Date) {
    this.assertOpen();
    if (buyerId === this.s.sellerId) throw new InvalidRequest('Vous ne pouvez pas accepter votre propre offre');
    if (this.isExpired(now)) throw new RuleViolation('Cette offre a expiré');
    this.s = { ...this.s, status: 'COMPLETED', buyerId, closedAt: now };
  }

  /** Retrait par le vendeur : la carte lui est rendue par le cas d'usage. */
  cancel(by: string, now: Date) {
    this.assertOpen();
    if (by !== this.s.sellerId) throw new Forbidden('Cette offre ne vous appartient pas');
    this.s = { ...this.s, status: 'CANCELLED', closedAt: now };
  }

  /** Expiration : la carte est rendue au vendeur. */
  expire(now: Date) {
    this.assertOpen();
    if (!this.isExpired(now)) throw new RuleViolation('Cette offre n’a pas encore expiré');
    this.s = { ...this.s, status: 'CANCELLED', closedAt: now };
  }
}
