<?php

declare(strict_types=1);

namespace App\Marketplace\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Historique des offres d'une enchère. */
#[ORM\Entity]
#[ORM\Table(name: 'bid')]
class Bid
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    public function __construct(
        #[ORM\Column(type: 'text')] private string $auctionId,
        #[ORM\Column(type: 'text')] private string $userId,
        #[ORM\Column] private int $amount,
        #[ORM\Column] private \DateTimeImmutable $createdAt,
    ) {
        $this->id = Uuid::v4()->toRfc4122();
    }
}
