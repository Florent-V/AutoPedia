<?php

declare(strict_types=1);

namespace App\Games\Event;

/** Une manche a été jouée (crédits ou carte gagnés, partie éventuellement terminée). */
final readonly class GameRoundPlayed
{
    public function __construct(public string $userId, public string $sessionId, public bool $finished)
    {
    }
}
