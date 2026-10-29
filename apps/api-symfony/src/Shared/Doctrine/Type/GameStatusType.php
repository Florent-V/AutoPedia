<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use App\Games\Domain\GameStatus;

/** Type PostgreSQL « GameStatus » ↔ enum PHP GameStatus. */
final class GameStatusType extends PostgresEnumType
{
    protected function enumClass(): string
    {
        return GameStatus::class;
    }

    protected function sqlType(): string
    {
        return 'GameStatus';
    }
}
