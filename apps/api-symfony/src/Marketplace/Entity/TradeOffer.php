<?php

declare(strict_types=1);

namespace App\Marketplace\Entity;

use App\Marketplace\Domain\TradeStatus;
use App\Shared\Domain\Exception\Forbidden;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Domain\Guard;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Offre de la bourse : une carte (mise sous séquestre) contre une autre carte ou contre des crédits.
 * Le prix et la carte demandée sont fixés à la création ; l'acheteur n'envoie que son acceptation.
 */
#[ORM\Entity(repositoryClass: \App\Marketplace\Repository\TradeOfferRepository::class)]
#[ORM\Table(name: 'trade_offer')]
class TradeOffer
{
    public const MAX_PRICE = 1_000_000;

    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    #[ORM\Column(type: 'text')]
    private string $sellerId;

    #[ORM\Column]
    private int $offeredCarId;

    #[ORM\Column(nullable: true)]
    private ?int $wantedCarId;

    #[ORM\Column(nullable: true)]
    private ?int $price;

    #[ORM\Column(type: 'trade_status')]
    private TradeStatus $status = TradeStatus::OPEN;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $buyerId = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $closedAt = null;

    public function __construct(string $sellerId, int $offeredCarId, ?int $wantedCarId, ?int $price, \DateTimeImmutable $now, int $durationDays)
    {
        if ((null === $wantedCarId) === (null === $price)) {
            throw new InvalidRequest('Indiquez soit une carte demandée en échange, soit un prix en crédits');
        }
        Guard::positiveInt($offeredCarId, 'Carte proposée');
        if (null !== $wantedCarId) {
            Guard::positiveInt($wantedCarId, 'Carte demandée');
        }
        if (null !== $price) {
            Guard::positiveInt($price, 'Prix', self::MAX_PRICE);
        }
        if ($wantedCarId === $offeredCarId) {
            throw new InvalidRequest('Impossible d’échanger une carte contre elle-même');
        }
        $this->id = Uuid::v4()->toRfc4122();
        $this->sellerId = $sellerId;
        $this->offeredCarId = $offeredCarId;
        $this->wantedCarId = $wantedCarId;
        $this->price = $price;
        $this->createdAt = $now;
        $this->expiresAt = $now->modify("+$durationDays days");
    }

    public function id(): string
    {
        return $this->id;
    }

    public function sellerId(): string
    {
        return $this->sellerId;
    }

    public function offeredCarId(): int
    {
        return $this->offeredCarId;
    }

    public function wantedCarId(): ?int
    {
        return $this->wantedCarId;
    }

    public function price(): ?int
    {
        return $this->price;
    }

    public function isExpired(\DateTimeImmutable $now): bool
    {
        return $this->expiresAt <= $now;
    }

    /** L'acheteur accepte : contreparties (carte demandée ou prix) réglées par le service. */
    public function accept(string $buyerId, \DateTimeImmutable $now): void
    {
        $this->assertOpen();
        if ($buyerId === $this->sellerId) {
            throw new InvalidRequest('Vous ne pouvez pas accepter votre propre offre');
        }
        if ($this->isExpired($now)) {
            throw new RuleViolation('Cette offre a expiré');
        }
        $this->status = TradeStatus::COMPLETED;
        $this->buyerId = $buyerId;
        $this->closedAt = $now;
    }

    /** Retrait par le vendeur : la carte lui est rendue par le service. */
    public function cancel(string $by, \DateTimeImmutable $now): void
    {
        $this->assertOpen();
        if ($by !== $this->sellerId) {
            throw new Forbidden('Cette offre ne vous appartient pas');
        }
        $this->status = TradeStatus::CANCELLED;
        $this->closedAt = $now;
    }

    /** Expiration : la carte est rendue au vendeur. */
    public function expire(\DateTimeImmutable $now): void
    {
        $this->assertOpen();
        if (!$this->isExpired($now)) {
            throw new RuleViolation('Cette offre n’a pas encore expiré');
        }
        $this->status = TradeStatus::CANCELLED;
        $this->closedAt = $now;
    }

    private function assertOpen(): void
    {
        if (TradeStatus::OPEN !== $this->status) {
            throw new RuleViolation('Cette offre n’est plus disponible');
        }
    }
}
