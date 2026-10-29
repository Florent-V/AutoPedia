<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use App\Games\Domain\GameType;

/** Type PostgreSQL « GameType » ↔ enum PHP GameType. */
final class GameTypeType extends PostgresEnumType
{
    protected function enumClass(): string
    {
        return GameType::class;
    }

    protected function sqlType(): string
    {
        return 'GameType';
    }
}
