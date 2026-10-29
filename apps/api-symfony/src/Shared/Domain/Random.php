<?php

declare(strict_types=1);

namespace App\Shared\Domain;

/**
 * Source d'aléatoire : nombre dans [0, 1[. Cryptographique en production (random_int),
 * déterministe dans les tests unitaires.
 */
interface Random
{
    public function next(): float;
}
