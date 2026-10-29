<?php

declare(strict_types=1);

namespace App\Games\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class AnswerInput
{
    /** « a » / « b » pour les duels, 0 à 3 pour les questions, 0 à 2 pour les portes (le domaine vérifie selon le jeu). */
    #[Assert\NotNull]
    #[Assert\Choice(choices: ['a', 'b', 0, 1, 2, 3], strict: true)]
    public mixed $choice;
}
