<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use App\Marketplace\Domain\TradeStatus;

/** Type PostgreSQL « TradeStatus » ↔ enum PHP TradeStatus. */
final class TradeStatusType extends PostgresEnumType
{
    protected function enumClass(): string
    {
        return TradeStatus::class;
    }

    protected function sqlType(): string
    {
        return 'TradeStatus';
    }
}
