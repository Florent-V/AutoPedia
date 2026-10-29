<?php

declare(strict_types=1);

namespace App\Games\Infrastructure;

use App\Catalog\Domain\Rarity;
use App\Catalog\Entity\Car;
use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;
use App\Games\Domain\GameType;
use App\Games\Domain\QuestionFactory;
use App\Shared\Domain\Random;
use App\Shared\Domain\Shuffle;
use Doctrine\DBAL\Connection;

/**
 * Questions tirées du catalogue en SQL. Tout l'aléatoire en mémoire (mélange des réponses, critère, portes)
 * passe par la source d'aléatoire cryptographique : la position de la bonne réponse est imprévisible.
 */
final class SqlQuestionFactory implements QuestionFactory
{
    /** Critères du duel : colonne, question, plus grand gagne ?, format de la réponse, écart minimal. */
    private const DUEL_STATS = [
        'topSpeedKmh' => ['Laquelle est la plus rapide ?', true, 'speed', 0.06],
        'powerKw' => ['Laquelle est la plus puissante ?', true, 'power', 0.1],
        'massKg' => ['Laquelle est la plus lourde ?', true, 'mass', 0.08],
        'lengthMm' => ['Laquelle est la plus longue ?', true, 'length', 0.05],
        'yearStart' => ['Laquelle est sortie en premier ?', false, 'year', 3],
        'popularity' => ['Laquelle est la plus célèbre ? (nombre de Wikipédias qui lui consacrent un article)', true, 'wikis', 4],
    ];

    public function __construct(
        private readonly Connection $db,
        private readonly CarRepository $cars,
        private readonly CardView $view,
        private readonly Random $random,
    ) {
    }

    public function make(GameType $type, array $used): ?array
    {
        return match ($type) {
            GameType::DUEL => $this->duel($used),
            GameType::QUIZ => $this->quiz($used),
            GameType::WEIGHT => $this->weight($used),
            GameType::MYSTERY => $this->mystery($used),
            GameType::DOORS => $this->doors(),
        };
    }

    /** @return array<string, mixed> carte réduite : jamais les valeurs qui donneraient la réponse */
    private function gameCard(Car $car): array
    {
        return ['id' => $car->getId(), 'name' => $car->name, 'manufacturer' => $car->manufacturer, 'imageUrl' => $this->view->imageUrl($car), 'rarity' => $car->effectiveRarity()->value];
    }

    /** @param list<int> $used */
    private function duel(array $used): ?array
    {
        foreach (Shuffle::of(array_keys(self::DUEL_STATS), $this->random) as $stat) {
            $rows = $this->db->fetchAllAssociative(
                "SELECT \"id\", \"$stat\"::float8 AS v FROM \"car\" WHERE \"active\" = true AND \"$stat\" IS NOT NULL AND \"$stat\" > 0
                 AND NOT (\"id\" = ANY(CAST(:used AS int[]))) ORDER BY random() LIMIT 40",
                ['used' => self::ints($used)],
            );
            for ($i = 0; $i < \count($rows); ++$i) {
                for ($j = $i + 1; $j < \count($rows); ++$j) {
                    [$x, $y] = [$rows[$i], $rows[$j]];
                    if (!$this->gapOk($stat, (float) $x['v'], (float) $y['v'])) {
                        continue;
                    }
                    $cars = $this->cars->byIds([(int) $x['id'], (int) $y['id']]);

                    return $this->duelRound($stat, $cars[(int) $x['id']], $cars[(int) $y['id']], (float) $x['v'], (float) $y['v']);
                }
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    private function duelRound(string $stat, Car $a, Car $b, float $va, float $vb): array
    {
        [$question, $higher, $format] = self::DUEL_STATS[$stat];
        $aWins = $higher ? $va > $vb : $va < $vb;

        return [
            'stat' => $stat,
            'question' => $question,
            'a' => $this->gameCard($a),
            'b' => $this->gameCard($b),
            'answer' => $aWins ? 'a' : 'b',
            'reveal' => ['a' => self::format($format, $va), 'b' => self::format($format, $vb)],
        ];
    }

    private function gapOk(string $stat, float $a, float $b): bool
    {
        $min = self::DUEL_STATS[$stat][3];

        return \in_array($stat, ['yearStart', 'popularity'], true) ? abs($a - $b) >= $min : abs($a - $b) / max($a, $b) >= $min;
    }

    private static function format(string $kind, float $v): string
    {
        $n = static fn (float $x) => rtrim(rtrim(number_format($x, 1, ',', "\u{202F}"), '0'), ',');

        return match ($kind) {
            'speed' => $n($v).' km/h',
            'power' => $n($v * 1.35962).' ch',
            'mass' => $n($v).' kg',
            'length' => $n($v / 1000).' m',
            'year' => (string) (int) $v,
            default => ((int) $v).' wikis',
        };
    }

    /** @param list<int> $used */
    private function quiz(array $used): ?array
    {
        foreach (Shuffle::of(['brand', 'country', 'decade', 'photo'], $this->random) as $kind) {
            $q = match ($kind) {
                'brand' => $this->quizBrand($used),
                'country' => ($car = $this->randomCar(null, '"country" IS NOT NULL', $used))
                    ? $this->build('country', "De quel pays vient la « {$car->name} » ?", $car, $car->country, $this->distinct('country', $car->country))
                    : null,
                'decade' => $this->quizDecade($used),
                'photo' => $this->quizPhoto($used),
            };
            if ($q) {
                return $q;
            }
        }

        return null;
    }

    /** @param list<int> $used */
    private function quizBrand(array $used): ?array
    {
        $car = $this->randomCar(null, '"manufacturer" IS NOT NULL', $used);
        if (!$car) {
            return null;
        }
        $q = $this->build('brand', "Quelle marque produit la « {$car->name} » ?", $car, $car->manufacturer, $this->distinct('manufacturer', $car->manufacturer));
        // Trop facile si le nom contient la marque : on le masque alors.
        if ($q && str_contains(mb_strtolower($car->name), mb_strtolower((string) $car->manufacturer))) {
            if (!$q['car']['imageUrl']) {
                return null;
            }
            $q['prompt'] = 'Quelle marque a produit cette voiture ?';
            $q['car']['name'] = null;
        }

        return $q;
    }

    /** @param list<int> $used */
    private function quizDecade(array $used): ?array
    {
        $car = $this->randomCar(null, '"yearStart" IS NOT NULL', $used);
        if (!$car) {
            return null;
        }
        $decade = intdiv($car->yearStart, 10) * 10;
        $candidates = array_values(array_filter(array_map(static fn ($d) => $decade + $d, [-30, -20, -10, 10, 20, 30]), static fn ($d) => $d >= 1880 && $d <= 2030));
        $others = \array_slice(Shuffle::of($candidates, $this->random), 0, 3);
        $q = $this->build('decade', "En quelle décennie la « {$car->name} » est-elle sortie ?", $car, "Années $decade", array_map(static fn ($d) => "Années $d", $others));
        if ($q) {
            // Décennies présentées dans l'ordre chronologique.
            $correct = $q['choices'][$q['answer']];
            sort($q['choices']);
            $q['answer'] = array_search($correct, $q['choices'], true);
        }

        return $q;
    }

    /** @param list<int> $used */
    private function quizPhoto(array $used): ?array
    {
        $car = $this->randomCar(null, '"imagePath" IS NOT NULL', $used);
        if (!$car) {
            return null;
        }
        $names = $this->db->fetchFirstColumn(
            'SELECT "name" FROM "car" WHERE "active" = true AND "id" <> :id AND "name" <> :name
             ORDER BY ("manufacturer" IS NOT DISTINCT FROM :brand) DESC, random() LIMIT 3',
            ['id' => $car->getId(), 'name' => $car->name, 'brand' => $car->manufacturer],
        );

        return $this->build('photo', 'Quel est ce modèle ?', $car, $car->name, $names, false);
    }

    /**
     * @param list<string> $others
     *
     * @return array<string, mixed>|null
     */
    private function build(string $kind, string $prompt, Car $car, string $correct, array $others, bool $showName = true): ?array
    {
        if (\count($others) < 3) {
            return null;
        }
        $choices = Shuffle::of([$correct, ...\array_slice($others, 0, 3)], $this->random);

        return [
            'kind' => $kind,
            'prompt' => $prompt,
            'car' => ['name' => $showName ? $car->name : null, 'imageUrl' => $this->view->imageUrl($car)],
            'choices' => $choices,
            'answer' => array_search($correct, $choices, true),
            'carId' => $car->getId(),
        ];
    }

    /**
     * Poids lourds : deux voitures dont la rareté est tirée comme dans un booster ; la plus lourde est à gagner.
     * Repli sur un autre critère du duel si le catalogue manque de masses connues.
     *
     * @param list<int> $used
     */
    private function weight(array $used): ?array
    {
        $hasMass = '"massKg" IS NOT NULL AND "massKg" > 0';
        for ($attempt = 0; $attempt < 6; ++$attempt) {
            $a = $this->randomCar($attempt < 4 ? Rarity::roll(false, $this->random) : null, $hasMass, $used);
            $b = $a ? $this->randomCar($attempt < 4 ? Rarity::roll(false, $this->random) : null, $hasMass, [...$used, $a->getId()]) : null;
            if (!$a || !$b || !$this->gapOk('massKg', $a->massKg, $b->massKg)) {
                continue;
            }

            return $this->duelRound('massKg', $a, $b, $a->massKg, $b->massKg) + ['prizeCarId' => $a->massKg > $b->massKg ? $a->getId() : $b->getId()];
        }
        $fallback = $this->duel($used);

        return $fallback ? $fallback + ['prizeCarId' => 'a' === $fallback['answer'] ? $fallback['a']['id'] : $fallback['b']['id']] : null;
    }

    /**
     * Question pour une carte : la difficulté suit la rareté (pays, décennie, année exacte).
     *
     * @param list<int> $used
     */
    private function mystery(array $used): ?array
    {
        $rarity = Rarity::roll(false, $this->random);
        $wanted = Rarity::RARE === $rarity ? 'decade' : (\in_array($rarity, [Rarity::EPIC, Rarity::LEGENDARY], true) ? 'year' : 'country');
        $order = 'country' === $wanted ? ['country', 'decade'] : [$wanted, 'decade', 'country'];
        foreach ($order as $kind) {
            $cond = 'country' === $kind ? '"country" IS NOT NULL' : '"yearStart" IS NOT NULL';
            $car = $this->randomCar($rarity, $cond, $used) ?? $this->randomCar(null, $cond, $used);
            if (!$car) {
                continue;
            }
            if ('country' === $kind) {
                $others = $this->distinct('country', $car->country);
                if (\count($others) < 3) {
                    continue;
                }
                $correct = $car->country;
                $choices = Shuffle::of([$correct, ...$others], $this->random);
            } elseif ('decade' === $kind) {
                $decade = intdiv($car->yearStart, 10) * 10;
                $first = min(max($decade - 10 * (int) floor($this->random->next() * 4), 1880), 2020 - 30);
                $choices = array_map(static fn ($i) => 'Années '.($first + $i * 10), [0, 1, 2, 3]);
                $correct = "Années $decade";
                if (!\in_array($correct, $choices, true)) {
                    continue;
                }
            } else {
                $y = $car->yearStart;
                $pool = Shuffle::of(array_values(array_filter(array_map(static fn ($d) => $y + $d, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]), static fn ($v) => $v <= (int) date('Y'))), $this->random);
                $correct = (string) $y;
                $choices = [$correct, ...array_map('strval', \array_slice($pool, 0, 3))];
                sort($choices);
            }
            $prompt = match ($kind) {
                'country' => 'De quel pays vient cette voiture ?',
                'decade' => 'En quelle décennie est-elle sortie ?',
                default => 'En quelle année est-elle sortie ?',
            };

            return [
                'kind' => $kind, 'prompt' => $prompt, 'card' => $this->gameCard($car), 'choices' => $choices,
                'answer' => array_search($correct, $choices, true), 'carId' => $car->getId(), 'prizeCarId' => $car->getId(),
            ];
        }

        return null;
    }

    /** Trois portes : une vide, une carte standard (Commune / Peu commune), une haut de gamme (Épique / Légendaire). */
    private function doors(): ?array
    {
        $s = $this->randomCar($this->random->next() < 0.7 ? Rarity::COMMON : Rarity::UNCOMMON, 'true', []) ?? $this->randomCar(null, 'true', []);
        $top = $this->random->next() < 0.8 ? Rarity::EPIC : Rarity::LEGENDARY;
        $t = $s ? ($this->randomCar($top, 'true', [$s->getId()]) ?? $this->randomCar(Rarity::EPIC === $top ? Rarity::LEGENDARY : Rarity::EPIC, 'true', [$s->getId()])) : null;
        if (!$s || !$t) {
            return null;
        }
        $outcomes = Shuffle::of([
            ['tier' => 'none', 'carId' => null],
            ['tier' => 'standard', 'carId' => $s->getId()],
            ['tier' => 'top', 'carId' => $t->getId()],
        ], $this->random);

        return ['kind' => 'doors', 'prompt' => 'Derrière quelle porte se cache la meilleure voiture ?', 'doors' => 3, 'outcomes' => $outcomes];
    }

    /**
     * Voiture aléatoire d'une rareté donnée (ou de n'importe quelle rareté) respectant une condition (SQL fixe, sans entrée utilisateur).
     *
     * @param list<int> $used
     */
    private function randomCar(?Rarity $rarity, string $where, array $used): ?Car
    {
        $sql = "SELECT \"id\" FROM \"car\" WHERE \"active\" = true AND $where AND NOT (\"id\" = ANY(CAST(:used AS int[])))"
            .($rarity ? ' AND COALESCE("rarityOverride", "rarity") = CAST(:rarity AS "Rarity")' : '').' ORDER BY random() LIMIT 1';
        $params = ['used' => self::ints($used)] + ($rarity ? ['rarity' => $rarity->value] : []);
        $id = $this->db->fetchOne($sql, $params);

        return false === $id ? null : $this->cars->find((int) $id);
    }

    /** @return list<string> trois valeurs distinctes de la colonne, différentes de $exclude */
    private function distinct(string $column, ?string $exclude): array
    {
        return $this->db->fetchFirstColumn(
            "SELECT v FROM (SELECT DISTINCT \"$column\" AS v FROM \"car\" WHERE \"active\" = true AND \"$column\" IS NOT NULL AND \"$column\" <> :ex) t ORDER BY random() LIMIT 3",
            ['ex' => (string) $exclude],
        );
    }

    /** @param list<int> $ids */
    private static function ints(array $ids): string
    {
        return '{'.implode(',', array_map('intval', $ids)).'}';
    }
}
