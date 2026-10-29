<?php

declare(strict_types=1);

namespace App\Notifications\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class SubscribeInput
{
    #[Assert\Url(protocols: ['https'], requireTld: false)]
    #[Assert\Length(max: 1000)]
    public string $endpoint;

    #[Assert\Valid]
    public PushKeys $keys;

    /** Envoyé par les anciennes versions de l'application (PushSubscription.toJSON) ; ignoré. */
    public ?float $expirationTime = null;
}
