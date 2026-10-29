<?php

declare(strict_types=1);

namespace App\Marketplace\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class BuyInput
{
    #[Assert\Length(max: 80)]
    public string $offerKey;
}
