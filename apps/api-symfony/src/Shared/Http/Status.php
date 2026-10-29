<?php

declare(strict_types=1);

namespace App\Shared\Http;

/** Code HTTP de succès d'une action (200 par défaut), lu par StatusListener. */
#[\Attribute(\Attribute::TARGET_METHOD)]
final readonly class Status
{
    public function __construct(public int $code)
    {
    }
}
