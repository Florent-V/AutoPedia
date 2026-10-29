<?php

declare(strict_types=1);

namespace App\Bots\Domain;

/** Profil d'un bot (stocké en JSON dans player.botProfile, mêmes clés que NestJS). */
final readonly class BotProfile
{
    /** Réglages par style : bidChance, generosity, wantMissing, sellChance. */
    public const STYLE_PRESETS = [
        'collectionneur' => ['bidChance' => 0.55, 'generosity' => 1.0, 'wantMissing' => 1.45, 'sellChance' => 0.15],
        'marchand' => ['bidChance' => 0.7, 'generosity' => 0.75, 'wantMissing' => 1.0, 'sellChance' => 0.5],
        'econome' => ['bidChance' => 0.35, 'generosity' => 0.6, 'wantMissing' => 1.1, 'sellChance' => 0.25],
        'passionne' => ['bidChance' => 0.45, 'generosity' => 1.15, 'wantMissing' => 1.3, 'sellChance' => 0.2],
    ];

    public function __construct(
        public string $style,
        /** Délai moyen entre deux passages du bot (minutes). */
        public int $activityMinutes,
        /** Probabilité de base d'enchérir quand l'affaire est intéressante. */
        public float $bidChance,
        /** Multiplicateur général de ce qu'il accepte de payer. */
        public float $generosity,
        /** Bonus de valeur pour une carte qu'il n'a pas encore. */
        public float $wantMissing,
        /** Probabilité de mettre un doublon en vente à chaque passage. */
        public float $sellChance,
        public ?string $favoriteBrand,
        public bool $likesRacing,
    ) {
    }

    public static function create(string $style, int $activityMinutes, ?string $favoriteBrand, bool $likesRacing): self
    {
        $p = self::STYLE_PRESETS[$style];

        return new self($style, $activityMinutes, $p['bidChance'], $p['generosity'], $p['wantMissing'], $p['sellChance'], $favoriteBrand, $likesRacing);
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            (string) $data['style'], (int) $data['activityMinutes'], (float) $data['bidChance'], (float) $data['generosity'],
            (float) $data['wantMissing'], (float) $data['sellChance'], $data['favoriteBrand'] ?? null, (bool) ($data['likesRacing'] ?? false),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return get_object_vars($this);
    }
}
