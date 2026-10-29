<?php

declare(strict_types=1);

namespace App\Shared\Domain\Exception;

/**
 * Erreur métier. Le domaine ne connaît pas HTTP : ApiExceptionListener traduit chaque type en code de réponse.
 * Les messages sont en français, prêts à afficher.
 */
abstract class DomainException extends \RuntimeException
{
    abstract public function httpStatus(): int;
}
