<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class AuctionListFilter extends MarketListFilter
{
    #[Assert\Choice(['all', 'selling', 'bidding'])]
    public string $tab = 'all';
}
