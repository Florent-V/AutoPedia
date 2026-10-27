/** Statistiques d'un joueur : base de calcul des succès. */
export interface PlayerStats {
  boostersOpened: number;
  cardsObtained: number;
  uniqueCards: number;
  points: number;
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  racing: number;
  maxPerBrand: number;
  countries: number;
  decades: number;
  maxQuantity: number;
  credits: number;
  creditsEarned: number;
  gamesPlayed: number;
  tradesCompleted: number;
  shopPurchases: number;
  gameCardsWon: number;
  doorsJackpots: number;
  auctionsWon: number;
  auctionsSold: number;
  bestStreak: number;
}

export type StatKey = keyof PlayerStats;
