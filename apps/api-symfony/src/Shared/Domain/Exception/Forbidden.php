<?php

declare(strict_types=1);

namespace App\Shared\Domain\Exception;

/** Action réservée à quelqu'un d'autre (403). */
final class Forbidden extends DomainException
{
    public function httpStatus(): int
    {
        return 403;
    }
}
