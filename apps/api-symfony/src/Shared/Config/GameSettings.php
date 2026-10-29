<?php

declare(strict_types=1);

namespace App\Shared\Config;

/** Réglages du jeu, issus des variables d'environnement (mêmes noms que le backend NestJS). */
final readonly class GameSettings
{
    public int $boosterRegenMs;

    public function __construct(
        int $boosterRegenMinutes,
        public int $boosterMax,
        public int $boosterStart,
        public int $cardsPerBooster,
        public int $pityEpic,
        public int $pityLegendary,
        public int $startingCredits,
        public int $gamesPerDay,
        public int $quickGamesPerDay,
        public int $doorsPerDay,
        public int $tradeDays,
        public int $maxOpenTrades,
        public int $auctionFeePercent,
        public int $maxOpenAuctions,
        public int $marketMinAccountHours,
        public int $marketMinBoosters,
        public int $tradeMaxRarityGap,
        public int $duelRounds = 10,
        public int $duelCreditsPerWin = 10,
        public int $quizQuestions = 5,
        public int $quizCreditsPerWin = 15,
        /** @var list<int> */
        public array $auctionDurations = [1, 3, 6, 12, 24],
        public int $auctionSnipeSeconds = 120,
    ) {
        $this->boosterRegenMs = $boosterRegenMinutes * 60_000;
    }
}
