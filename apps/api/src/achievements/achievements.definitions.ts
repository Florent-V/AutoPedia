import type { StatKey } from '../player/player-stats';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  category: 'Boosters' | 'Collection' | 'Rareté' | 'Exploration' | 'Score';
  stat: StatKey;
  goal: number;
}

const def = (
  id: string,
  category: AchievementDef['category'],
  name: string,
  description: string,
  icon: string,
  tier: BadgeTier,
  stat: StatKey,
  goal: number,
): AchievementDef => ({ id, category, name, description, icon, tier, stat, goal });

/** Catalogue des succès. Ajouter une entrée suffit : la progression est calculée à partir des statistiques. */
export const ACHIEVEMENTS: AchievementDef[] = [
  def('boosters-1', 'Boosters', 'Premier contact', 'Ouvrir votre premier booster', '🎁', 'bronze', 'boostersOpened', 1),
  def('boosters-10', 'Boosters', 'Mise en route', 'Ouvrir 10 boosters', '🔑', 'bronze', 'boostersOpened', 10),
  def('boosters-50', 'Boosters', 'Rodage terminé', 'Ouvrir 50 boosters', '⚙️', 'silver', 'boostersOpened', 50),
  def('boosters-200', 'Boosters', 'Grand tourisme', 'Ouvrir 200 boosters', '🛣️', 'gold', 'boostersOpened', 200),
  def('boosters-1000', 'Boosters', 'Million de kilomètres', 'Ouvrir 1 000 boosters', '🛞', 'platinum', 'boostersOpened', 1000),

  def('unique-10', 'Collection', 'Petit garage', 'Posséder 10 cartes différentes', '🏠', 'bronze', 'uniqueCards', 10),
  def('unique-50', 'Collection', 'Concession', 'Posséder 50 cartes différentes', '🏪', 'bronze', 'uniqueCards', 50),
  def('unique-150', 'Collection', 'Parc automobile', 'Posséder 150 cartes différentes', '🅿️', 'silver', 'uniqueCards', 150),
  def('unique-500', 'Collection', 'Musée de l’automobile', 'Posséder 500 cartes différentes', '🏛️', 'gold', 'uniqueCards', 500),
  def('unique-1000', 'Collection', 'Encyclopédie vivante', 'Posséder 1 000 cartes différentes', '📚', 'platinum', 'uniqueCards', 1000),
  def('duplicates-5', 'Collection', 'Flotte de société', 'Posséder 5 exemplaires d’une même carte', '🚕', 'bronze', 'maxQuantity', 5),

  def('rare-1', 'Rareté', 'Coup de chance', 'Obtenir une carte Rare', '💎', 'bronze', 'rare', 1),
  def('epic-1', 'Rareté', 'Pièce de collection', 'Obtenir une carte Épique', '🔮', 'silver', 'epic', 1),
  def('legendary-1', 'Rareté', 'Légende vivante', 'Obtenir une carte Légendaire', '👑', 'gold', 'legendary', 1),
  def('epic-10', 'Rareté', 'Salon privé', 'Posséder 10 cartes Épiques différentes', '🎩', 'gold', 'epic', 10),
  def('legendary-5', 'Rareté', 'Panthéon', 'Posséder 5 cartes Légendaires différentes', '🏆', 'platinum', 'legendary', 5),

  def('brand-5', 'Exploration', 'Fidèle à la marque', 'Posséder 5 cartes d’un même constructeur', '🔧', 'bronze', 'maxPerBrand', 5),
  def('brand-15', 'Exploration', 'Spécialiste', 'Posséder 15 cartes d’un même constructeur', '🛠️', 'silver', 'maxPerBrand', 15),
  def('countries-5', 'Exploration', 'Tour d’Europe', 'Posséder des voitures de 5 pays différents', '🗺️', 'bronze', 'countries', 5),
  def('countries-12', 'Exploration', 'Tour du monde', 'Posséder des voitures de 12 pays différents', '🌍', 'silver', 'countries', 12),
  def('racing-5', 'Exploration', 'Paddock', 'Posséder 5 voitures de course', '🏁', 'silver', 'racing', 5),
  def('racing-20', 'Exploration', 'Écurie officielle', 'Posséder 20 voitures de course', '🏎️', 'gold', 'racing', 20),
  def('decades-6', 'Exploration', 'Voyage dans le temps', 'Posséder des voitures de 6 décennies différentes', '⏳', 'silver', 'decades', 6),

  def('points-100', 'Score', 'Plein d’essence', 'Atteindre 100 points de collection', '⛽', 'bronze', 'points', 100),
  def('points-1000', 'Score', 'Pole position', 'Atteindre 1 000 points de collection', '🥇', 'silver', 'points', 1000),
  def('points-5000', 'Score', 'Champion du monde', 'Atteindre 5 000 points de collection', '🏎️', 'gold', 'points', 5000),
];
