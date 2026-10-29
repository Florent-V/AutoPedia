<?php

declare(strict_types=1);

namespace App\Catalog\Domain;

use App\Shared\Domain\Random;

/** Les cinq raretés, de la plus courante à la plus rare, avec leurs réglages. */
enum Rarity: string
{
    case COMMON = 'COMMON';
    case UNCOMMON = 'UNCOMMON';
    case RARE = 'RARE';
    case EPIC = 'EPIC';
    case LEGENDARY = 'LEGENDARY';

    public function label(): string
    {
        return match ($this) {
            self::COMMON => 'Commune',
            self::UNCOMMON => 'Peu commune',
            self::RARE => 'Rare',
            self::EPIC => 'Épique',
            self::LEGENDARY => 'Légendaire',
        };
    }

    /** Points de collection. */
    public function points(): int
    {
        return match ($this) {
            self::COMMON => 1,
            self::UNCOMMON => 3,
            self::RARE => 10,
            self::EPIC => 30,
            self::LEGENDARY => 100,
        };
    }

    /** Part du catalogue dans cette rareté (classement par notoriété). */
    public function catalogShare(): float
    {
        return match ($this) {
            self::COMMON => 0.5,
            self::UNCOMMON => 0.27,
            self::RARE => 0.15,
            self::EPIC => 0.06,
            self::LEGENDARY => 0.02,
        };
    }

    /** Probabilité de tirage (en %) d'un emplacement standard, puis de l'emplacement « vedette ». */
    public function dropWeight(bool $featured): float
    {
        return match ($this) {
            self::COMMON => $featured ? 0 : 62,
            self::UNCOMMON => $featured ? 55 : 26,
            self::RARE => $featured ? 33 : 9,
            self::EPIC => $featured ? 9.5 : 2.5,
            self::LEGENDARY => $featured ? 2.5 : 0.5,
        };
    }

    public function rank(): int
    {
        return array_search($this, self::cases(), true);
    }

    /** Tire une rareté selon les poids de tirage. */
    public static function roll(bool $featured, Random $random): self
    {
        $total = array_sum(array_map(static fn (self $r) => $r->dropWeight($featured), self::cases()));
        $roll = $random->next() * $total;
        foreach (self::cases() as $rarity) {
            $roll -= $rarity->dropWeight($featured);
            if ($roll < 0) {
                return $rarity;
            }
        }

        return self::LEGENDARY;
    }

    /** Raretés de la plus proche à la plus éloignée (repli quand une rareté n'a pas de carte). */
    public function nearest(): array
    {
        $cases = self::cases();
        usort($cases, fn (self $a, self $b) => abs($a->rank() - $this->rank()) <=> abs($b->rank() - $this->rank()) ?: $a->rank() <=> $b->rank());

        return $cases;
    }

    /**
     * Rareté de chaque carte d'après son classement de notoriété : les 2 % les plus célèbres sont légendaires,
     * les 6 % suivants épiques, etc. `$sortedIds` est trié du plus populaire au moins populaire.
     *
     * @param list<int> $sortedIds
     *
     * @return array<int, self>
     */
    public static function assign(array $sortedIds): array
    {
        $result = [];
        $n = \count($sortedIds);
        $cursor = 0;
        $cumulative = 0.0;
        foreach (array_reverse(self::cases()) as $rarity) {
            $cumulative += $rarity->catalogShare();
            $end = self::COMMON === $rarity ? $n : max($cursor + ($n > 0 ? 1 : 0), (int) round($n * $cumulative));
            for (; $cursor < min($end, $n); ++$cursor) {
                $result[$sortedIds[$cursor]] = $rarity;
            }
        }

        return $result;
    }
}
