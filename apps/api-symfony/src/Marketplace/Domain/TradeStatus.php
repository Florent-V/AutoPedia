<?php

declare(strict_types=1);

namespace App\Marketplace\Domain;

enum TradeStatus: string
{
    case OPEN = 'OPEN';
    case COMPLETED = 'COMPLETED';
    case CANCELLED = 'CANCELLED';
}
