<?php

declare(strict_types=1);

namespace App\Catalog\Infrastructure;

/** Modèle de voiture tel que lu dans Wikidata. */
final readonly class WikidataCar
{
    public function __construct(
        public string $qid,
        public string $name,
        public ?string $manufacturer,
        public ?string $country,
        public ?int $yearStart,
        public ?int $yearEnd,
        public ?string $imageUrl,
        public ?string $imageFile,
        public bool $racing,
        public ?string $wikiTitle,
        public ?string $wikiLang,
        public ?float $powerKw,
        public ?float $topSpeedKmh,
        public ?float $massKg,
        public ?int $lengthMm,
        public int $popularity,
    ) {
    }
}
