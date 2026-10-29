<?php

declare(strict_types=1);

namespace App\Games\Domain;

/** Règles d'un mini-jeu. */
final readonly class GameDef
{
    public function __construct(
        public string $name,
        public string $description,
        public int $rounds,
        /** Crédits par bonne réponse (jeux à crédits). */
        public int $creditsPerWin,
        public int $playsPerDay,
        /** « credits » : on gagne des crédits ; « card » : on remporte la carte en jeu. */
        public string $reward,
        /** La partie s'arrête à la première erreur. */
        public bool $endsOnMistake,
        /** Carte bonus pour un sans-faute (jeux à crédits). */
        public bool $perfectBonus,
        /** Réponses acceptées : « ab » ou le nombre de choix. */
        public string|int $choices,
    ) {
    }

    /** La réponse a la forme attendue par ce jeu (« a »/« b », ou un indice entier dans les bornes). */
    public function isValidChoice(mixed $choice): bool
    {
        if ('ab' === $this->choices) {
            return 'a' === $choice || 'b' === $choice;
        }

        return \is_int($choice) && $choice >= 0 && $choice < $this->choices;
    }

    /** @return array<string, mixed> */
    public function publicArray(): array
    {
        return [
            'name' => $this->name,
            'description' => $this->description,
            'rounds' => $this->rounds,
            'creditsPerWin' => $this->creditsPerWin,
            'playsPerDay' => $this->playsPerDay,
            'reward' => $this->reward,
            'endsOnMistake' => $this->endsOnMistake,
            'perfectBonus' => $this->perfectBonus,
        ];
    }
}
