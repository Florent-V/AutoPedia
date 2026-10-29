<?php

declare(strict_types=1);

namespace App\Shared\Domain\Exception;

/** Demande incohérente avec les règles (400). */
final class InvalidRequest extends DomainException
{
    public function httpStatus(): int
    {
        return 400;
    }
}
