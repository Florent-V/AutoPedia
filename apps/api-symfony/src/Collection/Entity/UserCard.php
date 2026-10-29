<?php

declare(strict_types=1);

namespace App\Collection\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Exemplaires d'une carte possédés par un joueur (clé composite joueur + carte ; quantité toujours ≥ 1). */
#[ORM\Entity]
#[ORM\Table(name: 'user_card')]
class UserCard
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $userId;

    #[ORM\Id]
    #[ORM\Column]
    private int $carId;

    #[ORM\Column]
    private int $quantity = 1;

    #[ORM\Column]
    private \DateTimeImmutable $firstObtainedAt;

    #[ORM\Column]
    private \DateTimeImmutable $lastObtainedAt;

    public function __construct(string $userId, int $carId, \DateTimeImmutable $now)
    {
        $this->userId = $userId;
        $this->carId = $carId;
        $this->firstObtainedAt = $now;
        $this->lastObtainedAt = $now;
    }

    public function addOne(\DateTimeImmutable $now): void
    {
        ++$this->quantity;
        $this->lastObtainedAt = $now;
    }

    /** Retire un exemplaire ; renvoie false s'il n'en reste plus (la ligne doit alors être supprimée). */
    public function removeOne(): bool
    {
        --$this->quantity;

        return $this->quantity > 0;
    }

    public function quantity(): int
    {
        return $this->quantity;
    }

    public function firstObtainedAt(): \DateTimeImmutable
    {
        return $this->firstObtainedAt;
    }
}
