<?php

declare(strict_types=1);

namespace App\Shared\Domain\Exception;

/** Règle du jeu qui s'oppose à l'action dans l'état actuel : solde, réserve vide, déjà fait… (409). */
final class RuleViolation extends DomainException
{
    public function httpStatus(): int
    {
        return 409;
    }
}
