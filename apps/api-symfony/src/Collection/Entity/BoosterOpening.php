<?php

declare(strict_types=1);

namespace App\Collection\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Historique : contenu de chaque booster ouvert. */
#[ORM\Entity]
#[ORM\Table(name: 'booster_opening')]
class BoosterOpening
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    /** @param list<int> $carIds */
    public function __construct(
        #[ORM\Column(type: 'text')] private string $userId,
        #[ORM\Column(type: 'int_array')] private array $carIds,
        #[ORM\Column] private \DateTimeImmutable $createdAt,
    ) {
        $this->id = Uuid::v4()->toRfc4122();
    }
}
