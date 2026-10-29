<?php

declare(strict_types=1);

namespace App\Wallet\Domain;

/** Motif d'un mouvement de crédits (journal). */
enum LedgerReason: string
{
    case GAME_DUEL = 'game:duel';
    case GAME_QUIZ = 'game:quiz';
    case SHOP = 'shop';
    case TRADE_SALE = 'trade:sale';
    case TRADE_PURCHASE = 'trade:purchase';
    case AUCTION_BID = 'auction:bid';
    case AUCTION_REFUND = 'auction:refund';
    case AUCTION_SALE = 'auction:sale';
    case ACHIEVEMENT = 'achievement';
    case DAILY = 'daily';
    case BOT_GAMES = 'bot:jeux';
    case BOT_ENDOWMENT = 'bot:dotation';

    public function label(): string
    {
        return match ($this) {
            self::GAME_DUEL => 'Duel de stats',
            self::GAME_QUIZ => 'Quiz auto',
            self::SHOP => 'Achat en boutique',
            self::TRADE_SALE => 'Vente à la bourse',
            self::TRADE_PURCHASE => 'Achat à la bourse',
            self::AUCTION_BID => 'Offre aux enchères (crédits bloqués)',
            self::AUCTION_REFUND => 'Enchère dépassée (remboursement)',
            self::AUCTION_SALE => 'Vente aux enchères',
            self::ACHIEVEMENT => 'Succès débloqué',
            self::DAILY => 'Récompense du jour',
            self::BOT_GAMES => 'Mini-jeux',
            self::BOT_ENDOWMENT => 'Dotation de départ',
        };
    }
}
