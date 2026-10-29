<?php

declare(strict_types=1);

namespace App\Player\Entity;

use App\Collection\Entity\BoosterReserve;
use App\Progression\Entity\DailyStreak;
use App\Wallet\Entity\Wallet;
use Doctrine\ORM\Mapping as ORM;

/**
 * État de jeu d'un compte (table « player »). C'est la racine que l'on verrouille (SELECT … FOR UPDATE)
 * avant toute action qui modifie le joueur. Chaque contexte possède sa partie, sous forme d'objet embarqué
 * (Doctrine Embeddable) qui porte ses règles : portefeuille, réserve de boosters, série quotidienne…
 */
#[ORM\Entity(repositoryClass: \App\Player\Repository\PlayerRepository::class)]
#[ORM\Table(name: 'player')]
#[ORM\HasLifecycleCallbacks]
class Player
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $userId;

    #[ORM\Embedded(class: Wallet::class, columnPrefix: false)]
    private Wallet $wallet;

    #[ORM\Embedded(class: BoosterReserve::class, columnPrefix: false)]
    private BoosterReserve $reserve;

    #[ORM\Embedded(class: DailyStreak::class, columnPrefix: false)]
    private DailyStreak $streak;

    #[ORM\Embedded(class: Activity::class, columnPrefix: false)]
    private Activity $activity;

    /** Réserve pleine déjà signalée par notification (contexte Notifications). */
    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $fullNotifiedAnchor = null;

    #[ORM\Column]
    private bool $isBot = false;

    /** @var array<string, mixed>|null personnalité d'un bot */
    #[ORM\Column(type: 'json', nullable: true, options: ['jsonb' => true])]
    private ?array $botProfile = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $botNextActionAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(string $userId, int $startingBoosters, int $startingCredits, \DateTimeImmutable $now)
    {
        $this->userId = $userId;
        $this->wallet = new Wallet($startingCredits);
        $this->reserve = new BoosterReserve($startingBoosters, $now);
        $this->streak = new DailyStreak();
        $this->activity = new Activity();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function userId(): string
    {
        return $this->userId;
    }

    public function wallet(): Wallet
    {
        return $this->wallet;
    }

    public function reserve(): BoosterReserve
    {
        return $this->reserve;
    }

    public function streak(): DailyStreak
    {
        return $this->streak;
    }

    public function activity(): Activity
    {
        return $this->activity;
    }

    public function isBot(): bool
    {
        return $this->isBot;
    }

    /** @return array<string, mixed>|null */
    public function botProfile(): ?array
    {
        return $this->botProfile;
    }

    public function botNextActionAt(): ?\DateTimeImmutable
    {
        return $this->botNextActionAt;
    }

    /** @param array<string, mixed> $profile */
    public function becomeBot(array $profile, \DateTimeImmutable $firstActionAt): void
    {
        $this->isBot = true;
        $this->botProfile = $profile;
        $this->botNextActionAt = $firstActionAt;
    }

    public function scheduleBot(\DateTimeImmutable $next): void
    {
        $this->botNextActionAt = $next;
    }

    public function fullNotifiedAnchor(): ?\DateTimeImmutable
    {
        return $this->fullNotifiedAnchor;
    }

    public function markFullNotified(\DateTimeImmutable $anchor): void
    {
        $this->fullNotifiedAnchor = $anchor;
    }
}
