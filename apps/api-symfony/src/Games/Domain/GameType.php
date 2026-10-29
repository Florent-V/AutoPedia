<?php

declare(strict_types=1);

namespace App\Games\Domain;

use App\Shared\Config\GameSettings;

enum GameType: string
{
    case DUEL = 'DUEL';
    case QUIZ = 'QUIZ';
    case WEIGHT = 'WEIGHT';
    case MYSTERY = 'MYSTERY';
    case DOORS = 'DOORS';

    public function def(GameSettings $s): GameDef
    {
        return match ($this) {
            self::DUEL => new GameDef('Duel de stats', 'Deux voitures, une question : laquelle est la plus rapide, la plus lourde, la plus ancienne… La partie s’arrête à la première erreur.', $s->duelRounds, $s->duelCreditsPerWin, $s->gamesPerDay, 'credits', true, true, 'ab'),
            self::QUIZ => new GameDef('Quiz auto', 'Cinq questions à 4 choix : marque, pays, décennie ou modèle en photo. Chaque bonne réponse rapporte des crédits.', $s->quizQuestions, $s->quizCreditsPerWin, $s->gamesPerDay, 'credits', false, true, 4),
            self::WEIGHT => new GameDef('Poids lourds', 'Deux voitures s’affrontent sur la balance. Désignez la plus lourde et elle rejoint votre garage !', 1, 0, $s->quickGamesPerDay, 'card', true, false, 'ab'),
            self::MYSTERY => new GameDef('Question pour une carte', 'Une carte, une question, quatre réponses. Plus la carte est rare, plus la question est pointue. Bonne réponse = carte gagnée.', 1, 0, $s->quickGamesPerDay, 'card', true, false, 4),
            self::DOORS => new GameDef('Les 3 garages', 'Trois portes fermées : un garage vide, une carte standard et une carte Épique ou Légendaire. À vous de choisir !', 1, 0, $s->doorsPerDay, 'card', true, false, 3),
        };
    }
}
