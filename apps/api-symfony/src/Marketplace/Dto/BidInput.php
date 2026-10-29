<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class BidInput
{
    #[Assert\Range(min: 1, max: 10_000_000)]
    public int $amount;
}
