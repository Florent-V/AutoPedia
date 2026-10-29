<?php

declare(strict_types=1);

namespace App\Identity\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Moyen de connexion d'un compte (« credential » = email + mot de passe haché).
 * Les bots n'ont pas de ligne ici : ils ne peuvent pas se connecter.
 */
#[ORM\Entity]
#[ORM\Table(name: 'account')]
#[ORM\HasLifecycleCallbacks]
class Account
{
    public const CREDENTIAL = 'credential';

    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    #[ORM\Column(type: 'text')]
    private string $accountId;

    #[ORM\Column(type: 'text')]
    private string $providerId;

    #[ORM\Column(type: 'text')]
    private string $userId;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $password;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(string $id, string $userId, string $passwordHash, \DateTimeImmutable $now)
    {
        $this->id = $id;
        $this->accountId = $userId;
        $this->providerId = self::CREDENTIAL;
        $this->userId = $userId;
        $this->password = $passwordHash;
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function changePasswordHash(string $hash): void
    {
        $this->password = $hash;
    }
}
