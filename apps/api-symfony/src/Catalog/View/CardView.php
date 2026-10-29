<?php

declare(strict_types=1);

namespace App\Catalog\View;

use App\Catalog\Entity\Car;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Vue d'une carte envoyée au client : uniquement des données publiques du catalogue (même format que NestJS). */
final readonly class CardView
{
    public function __construct(#[Autowire(env: 'bool:MEDIA_REMOTE_FALLBACK')] private bool $remoteFallback = true)
    {
    }

    /** @return array<string, mixed> */
    public function card(Car $car): array
    {
        $rarity = $car->effectiveRarity();

        return [
            'id' => $car->getId(),
            'name' => $car->name,
            'manufacturer' => $car->manufacturer,
            'country' => $car->country,
            'yearStart' => $car->yearStart,
            'yearEnd' => $car->yearEnd,
            'imageUrl' => $this->imageUrl($car),
            'racing' => $car->racing,
            'rarity' => $rarity->value,
            'points' => $rarity->points(),
            'powerHp' => $car->powerKw ? (int) round($car->powerKw * 1.35962) : null,
            'topSpeedKmh' => $car->topSpeedKmh ? (int) round($car->topSpeedKmh) : null,
            'massKg' => $car->massKg ? (int) round($car->massKg) : null,
            'lengthMm' => $car->lengthMm,
            'wikiUrl' => self::wikiUrl($car),
        ];
    }

    /** Photo servie par l'API si elle a été rapatriée, sinon (optionnellement) l'URL Wikimedia d'origine. */
    public function imageUrl(Car $car): ?string
    {
        if ($car->imagePath) {
            return '/api/media/'.$car->imagePath;
        }

        return $this->remoteFallback ? $car->imageUrl : null;
    }

    /** @return array<string, mixed>|null */
    public function imageCredit(Car $car): ?array
    {
        if (!$car->imageFile || !$car->imagePath) {
            return null;
        }

        return [
            'author' => $car->imageAuthor,
            'license' => $car->imageLicense,
            'licenseUrl' => $car->imageLicenseUrl,
            'sourceUrl' => 'https://commons.wikimedia.org/wiki/File:'.rawurlencode(str_replace(' ', '_', $car->imageFile)),
        ];
    }

    public static function wikiUrl(Car $car): ?string
    {
        if (!$car->wikiTitle) {
            return null;
        }

        return \sprintf('https://%s.wikipedia.org/wiki/%s', $car->wikiLang ?? 'fr', rawurlencode(str_replace(' ', '_', $car->wikiTitle)));
    }
}
