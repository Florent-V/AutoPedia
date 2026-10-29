<?php

declare(strict_types=1);

namespace App\Progression\Domain;

/**
 * Un succès : un palier à atteindre sur une statistique du joueur.
 * Ajouter une entrée à all() suffit : progression, déblocage, récompense et affichage sont automatiques.
 */
final readonly class Achievement
{
    public function __construct(
        public string $id,
        public string $category,
        public string $name,
        public string $description,
        public string $icon,
        public BadgeTier $tier,
        public string $stat,
        public int $goal,
    ) {
    }

    public function reward(): int
    {
        return $this->tier->reward();
    }

    /** @return list<self> */
    public static function all(): array
    {
        static $all = null;

        return $all ??= [
            new self('boosters-1', 'Boosters', 'Premier contact', 'Ouvrir votre premier booster', '🎁', BadgeTier::BRONZE, 'boostersOpened', 1),
            new self('boosters-10', 'Boosters', 'Mise en route', 'Ouvrir 10 boosters', '🔑', BadgeTier::BRONZE, 'boostersOpened', 10),
            new self('boosters-50', 'Boosters', 'Rodage terminé', 'Ouvrir 50 boosters', '⚙️', BadgeTier::SILVER, 'boostersOpened', 50),
            new self('boosters-200', 'Boosters', 'Grand tourisme', 'Ouvrir 200 boosters', '🛣️', BadgeTier::GOLD, 'boostersOpened', 200),
            new self('boosters-1000', 'Boosters', 'Million de kilomètres', 'Ouvrir 1 000 boosters', '🛞', BadgeTier::PLATINUM, 'boostersOpened', 1000),
            new self('unique-10', 'Collection', 'Petit garage', 'Posséder 10 cartes différentes', '🏠', BadgeTier::BRONZE, 'uniqueCards', 10),
            new self('unique-50', 'Collection', 'Concession', 'Posséder 50 cartes différentes', '🏪', BadgeTier::BRONZE, 'uniqueCards', 50),
            new self('unique-150', 'Collection', 'Parc automobile', 'Posséder 150 cartes différentes', '🅿️', BadgeTier::SILVER, 'uniqueCards', 150),
            new self('unique-500', 'Collection', 'Musée de l’automobile', 'Posséder 500 cartes différentes', '🏛️', BadgeTier::GOLD, 'uniqueCards', 500),
            new self('unique-1000', 'Collection', 'Encyclopédie vivante', 'Posséder 1 000 cartes différentes', '📚', BadgeTier::PLATINUM, 'uniqueCards', 1000),
            new self('duplicates-5', 'Collection', 'Flotte de société', 'Posséder 5 exemplaires d’une même carte', '🚕', BadgeTier::BRONZE, 'maxQuantity', 5),
            new self('rare-1', 'Rareté', 'Coup de chance', 'Obtenir une carte Rare', '💎', BadgeTier::BRONZE, 'rare', 1),
            new self('epic-1', 'Rareté', 'Pièce de collection', 'Obtenir une carte Épique', '🔮', BadgeTier::SILVER, 'epic', 1),
            new self('legendary-1', 'Rareté', 'Légende vivante', 'Obtenir une carte Légendaire', '👑', BadgeTier::GOLD, 'legendary', 1),
            new self('epic-10', 'Rareté', 'Salon privé', 'Posséder 10 cartes Épiques différentes', '🎩', BadgeTier::GOLD, 'epic', 10),
            new self('legendary-5', 'Rareté', 'Panthéon', 'Posséder 5 cartes Légendaires différentes', '🏆', BadgeTier::PLATINUM, 'legendary', 5),
            new self('brand-5', 'Exploration', 'Fidèle à la marque', 'Posséder 5 cartes d’un même constructeur', '🔧', BadgeTier::BRONZE, 'maxPerBrand', 5),
            new self('brand-15', 'Exploration', 'Spécialiste', 'Posséder 15 cartes d’un même constructeur', '🛠️', BadgeTier::SILVER, 'maxPerBrand', 15),
            new self('countries-5', 'Exploration', 'Tour d’Europe', 'Posséder des voitures de 5 pays différents', '🗺️', BadgeTier::BRONZE, 'countries', 5),
            new self('countries-12', 'Exploration', 'Tour du monde', 'Posséder des voitures de 12 pays différents', '🌍', BadgeTier::SILVER, 'countries', 12),
            new self('racing-5', 'Exploration', 'Paddock', 'Posséder 5 voitures de course', '🏁', BadgeTier::SILVER, 'racing', 5),
            new self('racing-20', 'Exploration', 'Écurie officielle', 'Posséder 20 voitures de course', '🏎️', BadgeTier::GOLD, 'racing', 20),
            new self('decades-6', 'Exploration', 'Voyage dans le temps', 'Posséder des voitures de 6 décennies différentes', '⏳', BadgeTier::SILVER, 'decades', 6),
            new self('games-1', 'Mini-jeux', 'Échauffement', 'Terminer une partie de mini-jeu', '🎮', BadgeTier::BRONZE, 'gamesPlayed', 1),
            new self('games-25', 'Mini-jeux', 'Pilote d’essai', 'Terminer 25 parties de mini-jeux', '🕹️', BadgeTier::SILVER, 'gamesPlayed', 25),
            new self('games-100', 'Mini-jeux', 'Encyclopédiste', 'Terminer 100 parties de mini-jeux', '🧠', BadgeTier::GOLD, 'gamesPlayed', 100),
            new self('gamecards-10', 'Mini-jeux', 'Butin', 'Gagner 10 cartes dans les mini-jeux', '🎴', BadgeTier::BRONZE, 'gameCardsWon', 10),
            new self('gamecards-100', 'Mini-jeux', 'Chasseur de trophées', 'Gagner 100 cartes dans les mini-jeux', '🏅', BadgeTier::GOLD, 'gameCardsWon', 100),
            new self('jackpot-1', 'Mini-jeux', 'Bonne porte', 'Trouver la carte Épique ou Légendaire des 3 garages', '🚪', BadgeTier::SILVER, 'doorsJackpots', 1),
            new self('credits-1000', 'Mini-jeux', 'Tirelire', 'Gagner 1 000 crédits au total', '💰', BadgeTier::SILVER, 'creditsEarned', 1000),
            new self('credits-10000', 'Mini-jeux', 'Coffre-fort', 'Gagner 10 000 crédits au total', '🏦', BadgeTier::GOLD, 'creditsEarned', 10000),
            new self('shop-1', 'Marché', 'Premier achat', 'Acheter une carte à la boutique', '🛒', BadgeTier::BRONZE, 'shopPurchases', 1),
            new self('shop-10', 'Marché', 'Client fidèle', 'Acheter 10 cartes à la boutique', '🛍️', BadgeTier::SILVER, 'shopPurchases', 10),
            new self('trades-1', 'Marché', 'Poignée de main', 'Conclure un échange à la bourse', '🤝', BadgeTier::BRONZE, 'tradesCompleted', 1),
            new self('trades-10', 'Marché', 'Négociant', 'Conclure 10 échanges à la bourse', '📈', BadgeTier::SILVER, 'tradesCompleted', 10),
            new self('trades-50', 'Marché', 'Courtier', 'Conclure 50 échanges à la bourse', '💼', BadgeTier::GOLD, 'tradesCompleted', 50),
            new self('auction-won-1', 'Marché', 'Adjugé !', 'Remporter une enchère', '🔨', BadgeTier::BRONZE, 'auctionsWon', 1),
            new self('auction-won-10', 'Marché', 'Collectionneur averti', 'Remporter 10 enchères', '🏛️', BadgeTier::GOLD, 'auctionsWon', 10),
            new self('auction-sold-5', 'Marché', 'Commissaire-priseur', 'Vendre 5 cartes aux enchères', '📣', BadgeTier::SILVER, 'auctionsSold', 5),
            new self('streak-3', 'Assiduité', 'Bonne habitude', 'Se connecter 3 jours d’affilée', '📅', BadgeTier::BRONZE, 'bestStreak', 3),
            new self('streak-7', 'Assiduité', 'Habitué du garage', 'Se connecter 7 jours d’affilée', '🗓️', BadgeTier::SILVER, 'bestStreak', 7),
            new self('streak-30', 'Assiduité', 'Fidèle au poste', 'Se connecter 30 jours d’affilée', '🔥', BadgeTier::PLATINUM, 'bestStreak', 30),
            new self('points-100', 'Score', 'Plein d’essence', 'Atteindre 100 points de collection', '⛽', BadgeTier::BRONZE, 'points', 100),
            new self('points-1000', 'Score', 'Pole position', 'Atteindre 1 000 points de collection', '🥇', BadgeTier::SILVER, 'points', 1000),
            new self('points-5000', 'Score', 'Champion du monde', 'Atteindre 5 000 points de collection', '🏎️', BadgeTier::GOLD, 'points', 5000),
        ];
    }

    /**
     * Succès atteints d'après les statistiques, parmi ceux pas encore débloqués.
     *
     * @param array<string, int> $stats
     * @param list<string>       $unlocked
     *
     * @return list<self>
     */
    public static function reached(array $stats, array $unlocked): array
    {
        return array_values(array_filter(
            self::all(),
            static fn (self $a) => !\in_array($a->id, $unlocked, true) && ($stats[$a->stat] ?? 0) >= $a->goal,
        ));
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'tier' => $this->tier->value,
            'stat' => $this->stat,
            'goal' => $this->goal,
        ];
    }
}
