<?php

declare(strict_types=1);

namespace App\Shared\Domain\Exception;

/** Objet inexistant, ou qui n'appartient pas au joueur (404). */
final class NotFound extends DomainException
{
    public function httpStatus(): int
    {
        return 404;
    }
}
