<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Uid\Uuid;

/** Identifiants reçus dans l'URL : mal formés → 400 (comme ParseUUIDPipe / ParseIntPipe en NestJS). */
final class Ids
{
    public static function uuid(string $value): string
    {
        if (!Uuid::isValid($value)) {
            throw new BadRequestHttpException('Identifiant invalide (UUID attendu)');
        }

        return strtolower($value);
    }

    public static function int(string $value): int
    {
        if (1 !== preg_match('/^\d{1,9}$/', $value)) {
            throw new BadRequestHttpException('Identifiant invalide (nombre attendu)');
        }

        return (int) $value;
    }
}
