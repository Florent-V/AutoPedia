<?php

declare(strict_types=1);

namespace App\Notifications\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class UnsubscribeInput
{
    #[Assert\Length(max: 1000)]
    public string $endpoint;
}
