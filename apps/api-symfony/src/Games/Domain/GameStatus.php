<?php

declare(strict_types=1);

namespace App\Games\Domain;

enum GameStatus: string
{
    case ACTIVE = 'ACTIVE';
    case FINISHED = 'FINISHED';
}
