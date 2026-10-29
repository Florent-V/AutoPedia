<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class TradeListFilter extends MarketListFilter
{
    #[Assert\Choice(['all', 'mine', 'forme'])]
    public string $tab = 'all';
}
