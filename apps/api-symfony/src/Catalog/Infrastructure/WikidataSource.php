<?php

declare(strict_types=1);

namespace App\Catalog\Infrastructure;

/**
 * Lecture du catalogue dans Wikidata (SPARQL) : modèles de série (Q3231690) et de course (Q90834785),
 * triés par notoriété, puis leurs détails par lots de 50.
 */
final class WikidataSource
{
    private const ENDPOINT = 'https://query.wikidata.org/sparql';
    private const FAMILIES = ['wd:Q3231690' => false, 'wd:Q90834785' => true];

    public function __construct(private readonly WikimediaClient $client)
    {
    }

    /** @return list<WikidataCar> */
    public function fetchCars(int $limit, ?callable $onProgress = null, int $minSitelinks = 3, int $batchSize = 50): array
    {
        $candidates = $this->listCandidates($limit, $minSitelinks);
        $cars = [];
        foreach (array_chunk($candidates, $batchSize) as $index => $batch) {
            $rows = $this->fetchDetails(array_column($batch, 'qid'));
            $byQid = [];
            foreach ($rows as $row) {
                $byQid[self::qidOf($row['car']['value'])][] = $row;
            }
            foreach ($batch as $c) {
                $car = $this->aggregate($c['qid'], $byQid[$c['qid']] ?? [], $c['popularity'], $c['image'], $c['racing']);
                if ($car) {
                    $cars[] = $car;
                }
            }
            if ($onProgress) {
                $onProgress(min(($index + 1) * $batchSize, \count($candidates)), \count($candidates));
            }
        }

        return $cars;
    }

    /** « http://commons.wikimedia.org/wiki/Special:FilePath/Ferrari%20F40.jpg » → « Ferrari F40.jpg » */
    public static function commonsFileName(string $url): string
    {
        return str_replace('_', ' ', rawurldecode(substr($url, strrpos($url, '/') + 1)));
    }

    /** @return list<array{qid: string, popularity: int, image: ?string, racing: bool}> */
    private function listCandidates(int $limit, int $minSitelinks): array
    {
        $byQid = [];
        foreach (self::FAMILIES as $root => $racing) {
            $rows = $this->sparql("SELECT ?car ?links ?img WHERE {
                ?class wdt:P279* $root .
                ?car wdt:P31 ?class ; wikibase:sitelinks ?links ; wdt:P18 ?img .
                FILTER(?links >= $minSitelinks)
            }");
            foreach ($rows as $r) {
                if (!isset($r['car'], $r['links'])) {
                    continue;
                }
                $qid = self::qidOf($r['car']['value']);
                $prev = $byQid[$qid] ?? null;
                $byQid[$qid] = [
                    'qid' => $qid,
                    'popularity' => max($prev['popularity'] ?? 0, (int) $r['links']['value']),
                    'image' => $prev['image'] ?? ($r['img']['value'] ?? null),
                    'racing' => ($prev['racing'] ?? false) || $racing,
                ];
            }
        }
        $list = array_values($byQid);
        usort($list, static fn ($a, $b) => $b['popularity'] <=> $a['popularity']);

        return \array_slice($list, 0, $limit);
    }

    /**
     * @param list<string> $qids
     *
     * @return list<array<string, array{type: string, value: string}>>
     */
    private function fetchDetails(array $qids): array
    {
        $values = implode(' ', array_map(static fn ($q) => "wd:$q", $qids));

        return $this->sparql(<<<SPARQL
            SELECT ?car ?frLabel ?enLabel ?brandFr ?brandEn ?mfrFr ?mfrEn ?countryFr ?countryEn ?makerCountryFr ?makerCountryEn
                   ?start ?end ?power ?speed ?mass ?length ?frTitle ?enTitle WHERE {
              VALUES ?car { $values }
              OPTIONAL { ?car rdfs:label ?frLabel FILTER(LANG(?frLabel) = "fr") }
              OPTIONAL { ?car rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
              OPTIONAL { ?car wdt:P1716 ?brand .
                OPTIONAL { ?brand rdfs:label ?brandFr FILTER(LANG(?brandFr) = "fr") }
                OPTIONAL { ?brand rdfs:label ?brandEn FILTER(LANG(?brandEn) = "en") } }
              OPTIONAL { ?car wdt:P176 ?mfr .
                OPTIONAL { ?mfr rdfs:label ?mfrFr FILTER(LANG(?mfrFr) = "fr") }
                OPTIONAL { ?mfr rdfs:label ?mfrEn FILTER(LANG(?mfrEn) = "en") } }
              OPTIONAL { ?car wdt:P495 ?country .
                OPTIONAL { ?country rdfs:label ?countryFr FILTER(LANG(?countryFr) = "fr") }
                OPTIONAL { ?country rdfs:label ?countryEn FILTER(LANG(?countryEn) = "en") } }
              OPTIONAL { ?car (wdt:P1716|wdt:P176)/wdt:P17 ?makerCountry .
                OPTIONAL { ?makerCountry rdfs:label ?makerCountryFr FILTER(LANG(?makerCountryFr) = "fr") }
                OPTIONAL { ?makerCountry rdfs:label ?makerCountryEn FILTER(LANG(?makerCountryEn) = "en") } }
              OPTIONAL { ?car wdt:P580|wdt:P571|wdt:P5204|wdt:P729|wdt:P577 ?start }
              OPTIONAL { ?car wdt:P582|wdt:P2669|wdt:P576|wdt:P730 ?end }
              OPTIONAL { ?car p:P2109/psn:P2109/wikibase:quantityAmount ?power }
              OPTIONAL { ?car p:P2052/psn:P2052/wikibase:quantityAmount ?speed }
              OPTIONAL { ?car p:P2067/psn:P2067/wikibase:quantityAmount ?mass }
              OPTIONAL { ?car p:P2043/psn:P2043/wikibase:quantityAmount ?length }
              OPTIONAL { ?fr schema:about ?car ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?frTitle }
              OPTIONAL { ?en schema:about ?car ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle }
            }
            SPARQL);
    }

    /** @param list<array<string, array{type: string, value: string}>> $rows */
    private function aggregate(string $qid, array $rows, int $popularity, ?string $image, bool $racing): ?WikidataCar
    {
        $first = static function (string ...$keys) use ($rows): ?string {
            foreach ($keys as $key) {
                foreach ($rows as $r) {
                    if (isset($r[$key]['value']) && '' !== $r[$key]['value']) {
                        return $r[$key]['value'];
                    }
                }
            }

            return null;
        };
        $nums = static fn (string $key) => array_values(array_filter(array_map(static fn ($r) => (float) ($r[$key]['value'] ?? 0), $rows), static fn ($n) => $n > 0));
        $years = static fn (string $key) => array_values(array_filter(array_map(static fn ($r) => isset($r[$key]['value']) && preg_match('/^(-?\d{1,4})/', $r[$key]['value'], $m) ? (int) $m[1] : null, $rows), static fn ($y) => null !== $y));

        $name = $first('frLabel', 'enLabel');
        if (!$name || preg_match('/^Q\d+$/', $name)) {
            return null;
        }
        $starts = $years('start');
        $ends = $years('end');
        $yearStart = $starts ? min($starts) : null;
        $yearEnd = $ends ? max($ends) : null;
        $powers = $nums('power');
        $speeds = $nums('speed');
        $masses = $nums('mass');
        $lengths = array_values(array_filter($nums('length'), static fn ($m) => $m > 1.5 && $m < 30));
        $frTitle = $first('frTitle');
        $enTitle = $first('enTitle');

        return new WikidataCar(
            qid: $qid,
            name: mb_substr($name, 0, 200),
            manufacturer: $first('brandFr', 'brandEn', 'mfrFr', 'mfrEn'),
            country: $first('countryFr', 'countryEn', 'makerCountryFr', 'makerCountryEn'),
            yearStart: $yearStart && $yearStart > 1850 && $yearStart < 2100 ? $yearStart : null,
            yearEnd: $yearEnd && $yearEnd > 1850 && $yearEnd < 2100 ? $yearEnd : null,
            imageUrl: $image ? preg_replace('/^http:/', 'https:', $image).'?width=640' : null,
            imageFile: $image ? self::commonsFileName($image) : null,
            racing: $racing,
            wikiTitle: $frTitle ?? $enTitle,
            wikiLang: $frTitle ? 'fr' : ($enTitle ? 'en' : null),
            powerKw: $powers ? max($powers) / 1000 : null,
            topSpeedKmh: $speeds ? max($speeds) * 3.6 : null,
            massKg: $masses ? min($masses) : null,
            lengthMm: $lengths ? (int) round(max($lengths) * 1000) : null,
            popularity: $popularity,
        );
    }

    /** @return list<array<string, array{type: string, value: string}>> */
    private function sparql(string $query): array
    {
        $response = $this->client->request('POST', self::ENDPOINT, [
            'headers' => ['Content-Type' => 'application/x-www-form-urlencoded', 'Accept' => 'application/sparql-results+json'],
            'body' => http_build_query(['query' => $query]),
        ], 90, 6, 180_000);

        return $response->toArray()['results']['bindings'] ?? [];
    }

    private static function qidOf(string $uri): string
    {
        return substr($uri, strrpos($uri, '/') + 1);
    }
}
