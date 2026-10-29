<?php

declare(strict_types=1);

namespace App\Marketplace\Domain;

use App\Catalog\Domain\Rarity;
use App\Shared\Domain\SeededRandom;
use App\Shared\Domain\Shuffle;

/**
 * Programme de la boutique, recalculé à chaque requête (rien n'est stocké) à partir d'une graine secrète :
 * stable pendant l'heure, différent l'heure suivante, sans répétition dans la journée. Mêmes résultats
 * que le backend NestJS pour un même secret (même générateur mulberry32).
 */
final class ShopRotation
{
    /** Réduction de « l'affaire de l'heure ». */
    public const DEAL_DISCOUNT = 0.25;

    /** @return array{perRotation: int, everyHours: int, price: int} */
    public static function rule(Rarity $rarity): array
    {
        return match ($rarity) {
            Rarity::COMMON => ['perRotation' => 3, 'everyHours' => 1, 'price' => 40],
            Rarity::UNCOMMON => ['perRotation' => 2, 'everyHours' => 1, 'price' => 120],
            Rarity::RARE => ['perRotation' => 2, 'everyHours' => 1, 'price' => 400],
            Rarity::EPIC => ['perRotation' => 1, 'everyHours' => 2, 'price' => 1200],
            Rarity::LEGENDARY => ['perRotation' => 1, 'everyHours' => 4, 'price' => 4000],
        };
    }

    /**
     * Offres visibles à une heure donnée.
     *
     * @param array<string, list<int>> $poolByRarity
     *
     * @return list<array{offerKey: string, rarity: string, carId: int, price: int, basePrice: int, deal: bool, untilHour: int}>
     */
    public static function offersAt(array $poolByRarity, string $secret, string $date, int $hour): array
    {
        $offers = [];
        foreach (Rarity::cases() as $rarity) {
            $rule = self::rule($rarity);
            $ids = $poolByRarity[$rarity->value] ?? [];
            sort($ids);
            // Programme du jour : ordre déterministe de toutes les cartes de la rareté.
            $programme = Shuffle::of($ids, new SeededRandom("$secret:$date:{$rarity->value}"));
            if (!$programme) {
                continue;
            }
            $rotation = intdiv($hour, $rule['everyHours']);
            $seen = [];
            for ($i = 0; $i < $rule['perRotation']; ++$i) {
                $carId = $programme[($rotation * $rule['perRotation'] + $i) % \count($programme)];
                if (isset($seen[$carId])) {
                    continue;
                }
                $seen[$carId] = true;
                $offers[] = [
                    'offerKey' => \sprintf('%sT%02d:%s:%d', $date, $rotation * $rule['everyHours'], $rarity->value, $i),
                    'rarity' => $rarity->value,
                    'carId' => $carId,
                    'price' => $rule['price'],
                    'basePrice' => $rule['price'],
                    'deal' => false,
                    'untilHour' => min(24, ($rotation + 1) * $rule['everyHours']),
                ];
            }
        }
        if ($offers) {
            $deal = (int) floor((new SeededRandom("$secret:$date:$hour:deal"))->next() * \count($offers));
            $offers[$deal]['deal'] = true;
            $offers[$deal]['price'] = (int) round($offers[$deal]['basePrice'] * (1 - self::DEAL_DISCOUNT));
        }

        return $offers;
    }
}
