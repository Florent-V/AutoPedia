<?php

declare(strict_types=1);

namespace App\Games\Domain;

/** Fabrique de manches (questions tirées du catalogue). Port implémenté par l'infrastructure (SQL). */
interface QuestionFactory
{
    /**
     * Une manche du jeu, sans réutiliser les cartes $used ; null si le catalogue ne le permet pas.
     *
     * @param list<int> $used
     *
     * @return array<string, mixed>|null
     */
    public function make(GameType $type, array $used): ?array;
}
