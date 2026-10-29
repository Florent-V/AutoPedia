<?php

declare(strict_types=1);

namespace App\Notifications\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class PushKeys
{
    #[Assert\Length(max: 200)]
    public string $p256dh;

    #[Assert\Length(max: 100)]
    public string $auth;
}
