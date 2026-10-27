import { Forbidden, InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { positiveInt } from '../../../shared/domain/guards';

export type AuctionStatus = 'OPEN' | 'SOLD' | 'UNSOLD' | 'CANCELLED';

export interface AuctionSnapshot {
  id: string;
  sellerId: string;
  carId: number;
  startPrice: number;
  currentBid: number | null;
  bidderId: string | null;
  bidCount: number;
  status: AuctionStatus;
  createdAt: Date;
  endsAt: Date;
  closedAt: Date | null;
}

export interface AuctionRules {
  durationsHours: readonly number[];
  maxStartPrice: number;
  maxBid: number;
  feePercent: number;
  /** Une offre dans les N dernières secondes prolonge l'enchère jusqu'à N secondes. */
  snipeSeconds: number;
}

/** Offre minimale : le prix de départ, puis +5 % (au moins 1 crédit) au-dessus de la meilleure offre. */
export function minBid(a: { startPrice: number; currentBid: number | null }): number {
  if (a.currentBid == null) return a.startPrice;
  return a.currentBid + Math.max(1, Math.ceil(a.currentBid * 0.05));
}

export type Settlement =
  | { outcome: 'UNSOLD'; sellerId: string; carId: number }
  | { outcome: 'SOLD'; sellerId: string; buyerId: string; carId: number; price: number; fee: number; sellerProceeds: number };

/**
 * Enchère : la carte est sous séquestre, chaque offre bloque les crédits de son auteur
 * et rembourse le précédent meilleur enchérisseur. Montants et dates sont contrôlés ici.
 */
export class Auction {
  private constructor(private s: AuctionSnapshot) {}

  static open(params: { id: string; sellerId: string; carId: number; startPrice: number; durationHours: number; now: Date; rules: AuctionRules }) {
    positiveInt(params.carId, 'Carte');
    positiveInt(params.startPrice, 'Prix de départ', params.rules.maxStartPrice);
    if (!params.rules.durationsHours.includes(params.durationHours)) {
      throw new InvalidRequest(`Durée invalide (${params.rules.durationsHours.join(', ')} heures)`);
    }
    return new Auction({
      id: params.id,
      sellerId: params.sellerId,
      carId: params.carId,
      startPrice: params.startPrice,
      currentBid: null,
      bidderId: null,
      bidCount: 0,
      status: 'OPEN',
      createdAt: params.now,
      endsAt: new Date(params.now.getTime() + params.durationHours * 3600 * 1000),
      closedAt: null,
    });
  }

  static restore(snapshot: AuctionSnapshot) {
    return new Auction({ ...snapshot });
  }

  snapshot(): AuctionSnapshot {
    return { ...this.s };
  }

  get id() {
    return this.s.id;
  }
  get sellerId() {
    return this.s.sellerId;
  }
  get carId() {
    return this.s.carId;
  }
  get bidderId() {
    return this.s.bidderId;
  }
  get currentBid() {
    return this.s.currentBid;
  }
  get endsAt() {
    return this.s.endsAt;
  }

  minBid() {
    return minBid(this.s);
  }

  private assertOpen(now: Date) {
    if (this.s.status !== 'OPEN' || this.s.endsAt <= now) throw new RuleViolation('Cette enchère est terminée');
  }

  /**
   * Nouvelle offre. Renvoie le meilleur enchérisseur précédent (à rembourser).
   * Les crédits du nouvel enchérisseur sont bloqués par le cas d'usage.
   */
  bid(userId: string, amount: number, now: Date, rules: AuctionRules): { previous: { userId: string; amount: number } | null } {
    positiveInt(amount, 'Montant', rules.maxBid);
    this.assertOpen(now);
    if (userId === this.s.sellerId) throw new InvalidRequest('Vous ne pouvez pas enchérir sur votre propre vente');
    if (userId === this.s.bidderId) throw new RuleViolation('Vous êtes déjà le meilleur enchérisseur');
    const min = this.minBid();
    if (amount < min) throw new InvalidRequest(`L’offre minimale est de ${min} crédits`);

    const previous = this.s.bidderId ? { userId: this.s.bidderId, amount: this.s.currentBid! } : null;
    const snipe = rules.snipeSeconds * 1000;
    const endsAt = this.s.endsAt.getTime() - now.getTime() < snipe ? new Date(now.getTime() + snipe) : this.s.endsAt;
    this.s = { ...this.s, currentBid: amount, bidderId: userId, bidCount: this.s.bidCount + 1, endsAt };
    return { previous };
  }

  /** Annulation par le vendeur, tant que personne n'a enchéri. */
  cancel(by: string, now: Date) {
    if (this.s.status !== 'OPEN') throw new RuleViolation('Cette enchère est terminée');
    if (by !== this.s.sellerId) throw new Forbidden('Cette enchère ne vous appartient pas');
    if (this.s.bidCount > 0) throw new RuleViolation('Impossible d’annuler : une offre a déjà été faite');
    this.s = { ...this.s, status: 'CANCELLED', closedAt: now };
  }

  isDue(now: Date) {
    return this.s.status === 'OPEN' && this.s.endsAt <= now;
  }

  /** Règlement à l'échéance : carte à l'acheteur, prix moins la commission au vendeur (la commission sort de l'économie). */
  settle(now: Date, rules: AuctionRules): Settlement {
    if (!this.isDue(now)) throw new RuleViolation('Cette enchère n’est pas terminée');
    const buyerId = this.s.bidderId;
    const price = this.s.currentBid;
    if (!buyerId || price == null) {
      this.s = { ...this.s, status: 'UNSOLD', closedAt: now };
      return { outcome: 'UNSOLD', sellerId: this.s.sellerId, carId: this.s.carId };
    }
    const fee = Math.floor((price * rules.feePercent) / 100);
    this.s = { ...this.s, status: 'SOLD', closedAt: now };
    return { outcome: 'SOLD', sellerId: this.s.sellerId, buyerId, carId: this.s.carId, price, fee, sellerProceeds: price - fee };
  }
}
