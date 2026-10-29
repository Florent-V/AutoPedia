<?php

declare(strict_types=1);

namespace App\Marketplace\Event;

/** Un joueur a été surenchéri (ses crédits lui ont été rendus). */
final readonly class AuctionOutbid
{
    public function __construct(public string $auctionId, public string $outbidUserId, public int $carId, public int $newBid)
    {
    }
}
