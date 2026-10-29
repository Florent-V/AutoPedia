<?php

declare(strict_types=1);

namespace App\Player\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Compteurs d'activité du joueur (mini-jeux, marché), base des statistiques et des succès. */
#[ORM\Embeddable]
class Activity
{
    #[ORM\Column]
    public int $gamesPlayed = 0;

    #[ORM\Column]
    public int $gameCardsWon = 0;

    #[ORM\Column]
    public int $doorsJackpots = 0;

    #[ORM\Column]
    public int $tradesCompleted = 0;

    #[ORM\Column]
    public int $shopPurchases = 0;

    #[ORM\Column]
    public int $auctionsWon = 0;

    #[ORM\Column]
    public int $auctionsSold = 0;
}
