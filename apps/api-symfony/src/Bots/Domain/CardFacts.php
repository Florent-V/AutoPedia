<?php

declare(strict_types=1);

namespace App\Bots\Domain;

use App\Catalog\Domain\Rarity;
use App\Catalog\Entity\Car;

final readonly class CardFacts
{
    public function __construct(public Rarity $rarity, public ?string $manufacturer, public bool $racing)
    {
    }

    public static function of(Car $car): self
    {
        return new self($car->effectiveRarity(), $car->manufacturer, $car->racing);
    }
}
