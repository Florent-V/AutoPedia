<?php

declare(strict_types=1);

namespace App\Collection\Domain;

use App\Catalog\Domain\Rarity;
use App\Shared\Domain\Random;

/** Garanties d'un booster : une Épique (ou mieux) tous les N boosters, une Légendaire tous les M. */
final readonly class Pity
{
    public function __construct(public bool $epic = false, public bool $legendary = false)
    {
    }

    /** Garantie du prochain booster d'après le nombre de boosters ouverts sans Épique / Légendaire. */
    public static function for(int $sinceEpic, int $sinceLegendary, int $epicEvery, int $legendaryEvery): self
    {
        return new self($sinceEpic + 1 >= $epicEvery, $sinceLegendary + 1 >= $legendaryEvery);
    }

    /**
     * Raretés des emplacements d'un booster : le dernier est une carte « vedette » (peu commune ou mieux).
     * La garantie ne s'applique que si le tirage normal ne l'a pas déjà satisfaite.
     *
     * @return list<Rarity>
     */
    public function rollBooster(int $count, Random $random): array
    {
        $slots = [];
        for ($i = 0; $i < $count; ++$i) {
            $slots[] = Rarity::roll($i === $count - 1, $random);
        }
        $last = $count - 1;
        if ($this->legendary && !\in_array(Rarity::LEGENDARY, $slots, true)) {
            $slots[$last] = Rarity::LEGENDARY;
        } elseif ($this->epic && !\in_array(Rarity::EPIC, $slots, true) && !\in_array(Rarity::LEGENDARY, $slots, true)) {
            $slots[$last] = $random->next() < 0.2 ? Rarity::LEGENDARY : Rarity::EPIC;
        }

        return $slots;
    }

    /** @return array{epic: bool, legendary: bool} */
    public function toArray(): array
    {
        return ['epic' => $this->epic, 'legendary' => $this->legendary];
    }
}
