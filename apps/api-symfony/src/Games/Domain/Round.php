<?php

declare(strict_types=1);

namespace App\Games\Domain;

/**
 * Une manche est un tableau (stocké en JSON dans game_session.state). Ces fonctions pures
 * la jugent et en produisent la vue publique, sans jamais exposer les champs secrets.
 */
final class Round
{
    /** Champs secrets : ils restent sur le serveur jusqu'à la réponse. */
    public const SECRET_KEYS = ['answer', 'reveal', 'carId', 'prizeCarId', 'outcomes'];

    /**
     * @param array<string, mixed> $round
     *
     * @return array<string, mixed>
     */
    public static function publicQuestion(array $round): array
    {
        return array_diff_key($round, array_flip(self::SECRET_KEYS));
    }

    /**
     * @param array<string, mixed> $round
     *
     * @return array{correct: bool, prizeCarId: ?int, jackpot: bool}
     */
    public static function judge(array $round, string|int $choice, bool $rewardsCard): array
    {
        if ('doors' === ($round['kind'] ?? null)) {
            $door = $round['outcomes'][$choice];

            return ['correct' => 'none' !== $door['tier'], 'prizeCarId' => $door['carId'], 'jackpot' => 'top' === $door['tier']];
        }
        $correct = $choice === $round['answer'];

        return ['correct' => $correct, 'prizeCarId' => $correct && $rewardsCard ? ($round['prizeCarId'] ?? null) : null, 'jackpot' => false];
    }

    /**
     * Cartes utilisées par une manche (pour ne pas les reproposer dans la même partie).
     *
     * @param array<string, mixed> $round
     *
     * @return list<int>
     */
    public static function carsUsedBy(array $round): array
    {
        if ('doors' === ($round['kind'] ?? null)) {
            return [];
        }
        if (isset($round['carId'])) {
            return [$round['carId']];
        }

        return [$round['a']['id'], $round['b']['id']];
    }
}
