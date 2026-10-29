<?php

declare(strict_types=1);

namespace App\Marketplace\Domain;

enum AuctionStatus: string
{
    case OPEN = 'OPEN';
    case SOLD = 'SOLD';
    case UNSOLD = 'UNSOLD';
    case CANCELLED = 'CANCELLED';
}
