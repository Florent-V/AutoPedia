<?php

declare(strict_types=1);

namespace App\Shared\Domain;

final class Shuffle
{
    /**
     * Mélange de Fisher-Yates (copie).
     *
     * @template T
     *
     * @param list<T> $items
     *
     * @return list<T>
     */
    public static function of(array $items, Random $random): array
    {
        $out = array_values($items);
        for ($i = \count($out) - 1; $i > 0; --$i) {
            $j = (int) floor($random->next() * ($i + 1));
            [$out[$i], $out[$j]] = [$out[$j], $out[$i]];
        }

        return $out;
    }

    /**
     * @template T
     *
     * @param list<T> $items
     *
     * @return T
     */
    public static function pick(array $items, Random $random): mixed
    {
        return $items[(int) floor($random->next() * \count($items))];
    }
}
