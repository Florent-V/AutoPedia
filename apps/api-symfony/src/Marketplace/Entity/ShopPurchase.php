<?php

declare(strict_types=1);

namespace App\Marketplace\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Achat en boutique : unique par joueur et par offre (contrainte en base). */
#[ORM\Entity]
#[ORM\Table(name: 'shop_purchase')]
class ShopPurchase
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    public function __construct(
        #[ORM\Column(type: 'text')] private string $userId,
        #[ORM\Column(type: 'text')] private string $offerKey,
        #[ORM\Column] private int $carId,
        #[ORM\Column] private int $price,
        #[ORM\Column] private \DateTimeImmutable $createdAt,
    ) {
        $this->id = Uuid::v4()->toRfc4122();
    }

    public function id(): string
    {
        return $this->id;
    }
}
