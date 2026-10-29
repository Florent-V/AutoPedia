<?php

declare(strict_types=1);

namespace App\Shared\Domain\Exception;

/** Service momentanément impossible, par exemple catalogue vide (503). */
final class Unavailable extends DomainException
{
    public function httpStatus(): int
    {
        return 503;
    }
}
