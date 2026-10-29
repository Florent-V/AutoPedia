<?php

declare(strict_types=1);

namespace App\Bots\Domain;

use App\Catalog\Domain\Rarity;
use App\Shared\Domain\Random;

/**
 * « Cerveau » des bots : fonctions pures (testables) qui estiment la valeur d'une carte
 * et décident d'enchérir, d'accepter un échange ou de vendre. Le hasard est injecté.
 */
final readonly class BotBrain
{
    /** Valeur de référence d'une carte par rareté (alignée sur les prix de la boutique). */
    public const REF_VALUE = ['COMMON' => 40, 'UNCOMMON' => 120, 'RARE' => 400, 'EPIC' => 1200, 'LEGENDARY' => 4000];

    /** Pseudos des bots (inventés). */
    public const NAMES = [
        'Turbo_Lulu', 'Mécano76', 'GTI_Forever', 'Rallye_Max', 'Carbu_Claire', 'V8_Vince', 'Alpine_Anna', 'Drift_Kiki',
        'Youngtimer_Yan', 'Stratos_83', 'Rotary_Rémi', 'Panda4x4', 'Boxer_Flat6', 'Diesel_Dan', 'La_Coccinelle', 'PistonsEtPaillettes',
    ];

    public function __construct(private Random $random)
    {
    }

    private static function ref(Rarity $rarity): int
    {
        return self::REF_VALUE[$rarity->value];
    }

    /** Combien ce bot est prêt à payer pour cette carte, compte tenu de ce qu'il possède déjà. */
    public function valuation(BotProfile $profile, CardFacts $card, int $ownedQty): int
    {
        $v = self::ref($card->rarity);
        $v *= 0 === $ownedQty ? $profile->wantMissing : (1 === $ownedQty ? 0.7 : 0.4);
        if ($profile->favoriteBrand && $card->manufacturer === $profile->favoriteBrand) {
            $v *= 'passionne' === $profile->style ? 1.8 : 1.3;
        }
        if ($profile->likesRacing && $card->racing) {
            $v *= 1.3;
        }
        $v *= $profile->generosity;
        $v *= 0.85 + $this->random->next() * 0.3; // humeur du moment

        return max(1, (int) round($v));
    }

    /**
     * Décide d'une enchère : null pour passer son tour, sinon le montant proposé.
     * Le bot n'enchérit jamais au-delà de sa valeur estimée, et pas systématiquement :
     * plus l'affaire est bonne ou la fin proche, plus il est tenté.
     */
    public function decideBid(BotProfile $profile, int $valuation, int $min, int $msLeft, bool $sellerIsBot): ?int
    {
        if ($min > $valuation) {
            return null;
        }
        $chance = $profile->bidChance;
        if ($msLeft < 15 * 60 * 1000) {
            $chance *= 1.5;
        }
        if ($min < $valuation * 0.6) {
            $chance *= 1.3;
        }
        if ($sellerIsBot) {
            $chance *= 0.4; // les bots animent surtout le marché des joueurs
        }
        if ($this->random->next() > min(0.95, $chance)) {
            return null;
        }

        return min($valuation, $min + (int) round($min * $this->random->next() * 0.12));
    }

    /** Accepter une offre de la bourse contre des crédits ? */
    public function acceptsPriceOffer(BotProfile $profile, int $valuation, int $price): bool
    {
        return $price <= $valuation * 0.9 && $this->random->next() < $profile->bidChance;
    }

    /** Accepter un échange carte contre carte ? (il doit garder au moins un exemplaire de la carte demandée) */
    public function acceptsSwap(BotProfile $profile, int $offeredValue, int $wantedValue, int $wantedQty): bool
    {
        return $wantedQty >= 2 && $offeredValue >= $wantedValue * 0.9 && $this->random->next() < $profile->bidChance;
    }

    /** Prix de départ d'une enchère mise en vente par un bot (une affaire possible pour les joueurs). */
    public function auctionStartPrice(CardFacts $card): int
    {
        return max(5, (int) round(self::ref($card->rarity) * (0.3 + $this->random->next() * 0.3)));
    }

    /** Prix demandé à la bourse par un bot. */
    public function tradeAskPrice(BotProfile $profile, CardFacts $card): int
    {
        $greed = 'marchand' === $profile->style ? 1.1 : 0.85;

        return max(5, (int) round(self::ref($card->rarity) * $greed * (0.85 + $this->random->next() * 0.3)));
    }
}
