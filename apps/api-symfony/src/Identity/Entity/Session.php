<?php

declare(strict_types=1);

namespace App\Identity\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Session de connexion. Le cookie contient un jeton aléatoire ; la base n'en garde que l'empreinte SHA-256 :
 * une fuite de la table ne permet pas de se faire passer pour un joueur.
 */
#[ORM\Entity]
#[ORM\Table(name: 'session')]
#[ORM\HasLifecycleCallbacks]
class Session
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    #[ORM\Column(type: 'text', unique: true)]
    private string $token;

    #[ORM\Column]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $ipAddress;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $userAgent;

    #[ORM\Column(type: 'text')]
    private string $userId;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(string $id, string $tokenHash, string $userId, \DateTimeImmutable $expiresAt, ?string $ip, ?string $userAgent, \DateTimeImmutable $now)
    {
        $this->id = $id;
        $this->token = $tokenHash;
        $this->userId = $userId;
        $this->expiresAt = $expiresAt;
        $this->ipAddress = $ip;
        $this->userAgent = null === $userAgent ? null : mb_substr($userAgent, 0, 300);
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getExpiresAt(): \DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function isExpired(\DateTimeImmutable $now): bool
    {
        return $this->expiresAt <= $now;
    }

    /** Prolonge une session active (au plus une fois par jour). */
    public function extendIfStale(\DateTimeImmutable $now, int $lifetimeSeconds, int $updateAgeSeconds): bool
    {
        if ($this->expiresAt->getTimestamp() - $now->getTimestamp() > $lifetimeSeconds - $updateAgeSeconds) {
            return false;
        }
        $this->expiresAt = $now->modify("+$lifetimeSeconds seconds");

        return true;
    }
}
