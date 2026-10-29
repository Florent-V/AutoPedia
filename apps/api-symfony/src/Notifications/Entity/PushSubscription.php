<?php

declare(strict_types=1);

namespace App\Notifications\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Abonnement Web Push d'un navigateur (une adresse unique par navigateur). */
#[ORM\Entity]
#[ORM\Table(name: 'push_subscription')]
class PushSubscription
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    public string $id;

    #[ORM\Column(type: 'text')]
    public string $userId;

    #[ORM\Column(type: 'text', unique: true)]
    public string $endpoint;

    #[ORM\Column(type: 'text')]
    public string $p256dh;

    #[ORM\Column(type: 'text')]
    public string $auth;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $userAgent = null;

    #[ORM\Column]
    public \DateTimeImmutable $createdAt;
}
