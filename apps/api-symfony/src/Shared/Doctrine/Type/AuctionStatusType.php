<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use App\Marketplace\Domain\AuctionStatus;

/** Type PostgreSQL « AuctionStatus » ↔ enum PHP AuctionStatus. */
final class AuctionStatusType extends PostgresEnumType
{
    protected function enumClass(): string
    {
        return AuctionStatus::class;
    }

    protected function sqlType(): string
    {
        return 'AuctionStatus';
    }
}
