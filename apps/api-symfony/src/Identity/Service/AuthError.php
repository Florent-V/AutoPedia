<?php

declare(strict_types=1);

namespace App\Identity\Service;

/** Erreur d'authentification au format attendu par le client Better Auth : { code, message }. */
final class AuthError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}
