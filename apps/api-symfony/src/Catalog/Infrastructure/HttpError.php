<?php

declare(strict_types=1);

namespace App\Catalog\Infrastructure;

final class HttpError extends \RuntimeException
{
    public function __construct(public readonly int $status, string $url)
    {
        parent::__construct(\sprintf('HTTP %d sur %s', $status, mb_substr($url, 0, 120)));
    }

    /** Erreur passagère (débit limité, accès refusé, serveur indisponible) : on arrête et on reprendra plus tard. */
    public function isTransient(): bool
    {
        return 403 === $this->status || 429 === $this->status || $this->status >= 500;
    }
}
