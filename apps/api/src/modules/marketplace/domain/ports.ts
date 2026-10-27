import { Rarity } from '../../catalog/domain/rarity';
import { Auction } from './auction';
import { TraderProfile } from './market-policy';
import { TradeOffer } from './trade-offer';

export abstract class TradeOfferRepository {
  /** Offre verrouillée (`FOR UPDATE`) ; 404 si elle n'existe pas. */
  abstract getForUpdate(id: string): Promise<TradeOffer>;
  abstract create(offer: TradeOffer): Promise<void>;
  abstract save(offer: TradeOffer): Promise<void>;
  abstract countOpenBySeller(sellerId: string): Promise<number>;
  abstract expiredIds(now: Date, limit: number): Promise<string[]>;
}

export abstract class AuctionRepository {
  /** Enchère verrouillée (`FOR UPDATE`) ; 404 si elle n'existe pas. */
  abstract getForUpdate(id: string): Promise<Auction>;
  abstract create(auction: Auction): Promise<void>;
  abstract save(auction: Auction): Promise<void>;
  abstract recordBid(auctionId: string, userId: string, amount: number): Promise<void>;
  abstract countOpenBySeller(sellerId: string): Promise<number>;
  abstract dueIds(now: Date, limit: number): Promise<string[]>;
}

export abstract class ShopPurchaseRepository {
  abstract exists(userId: string, offerKey: string): Promise<boolean>;
  /** Enregistre l'achat (unique par joueur et par offre) ; renvoie son identifiant. */
  abstract create(purchase: { userId: string; offerKey: string; carId: number; price: number }): Promise<string>;
}

/** Cartes actives par rareté (programme de la boutique). */
export abstract class ShopCatalog {
  abstract idsByRarity(): Promise<Partial<Record<Rarity, number[]>>>;
}

/** Compteurs du joueur liés au marché (statistiques et succès). */
export abstract class MarketCounters {
  abstract add(userId: string, counters: { shopPurchases?: number; tradesCompleted?: number; auctionsWon?: number; auctionsSold?: number }): Promise<void>;
}

/** Ancienneté et activité d'un joueur (garde-fous contre les comptes multiples). */
export abstract class TraderProfiles {
  abstract get(userId: string): Promise<TraderProfile>;
}
