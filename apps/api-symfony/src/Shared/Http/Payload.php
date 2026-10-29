<?php

declare(strict_types=1);

namespace App\Shared\Http;

/**
 * Argument de contrôleur construit depuis le corps JSON (« body ») ou les paramètres d'URL (« query »),
 * avec refus de tout champ non prévu par la classe (équivalent de forbidNonWhitelisted en NestJS).
 */
#[\Attribute(\Attribute::TARGET_PARAMETER)]
final readonly class Payload
{
    public function __construct(public string $from = 'body')
    {
    }
}
