<?php

declare(strict_types=1);

namespace App\Marketplace\Entity;

use App\Marketplace\Domain\AuctionStatus;
use App\Shared\Domain\Exception\Forbidden;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Domain\Guard;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Enchère : la carte est sous séquestre, chaque offre bloque les crédits de son auteur
 * et rembourse le précédent meilleur enchérisseur. Montants et dates sont contrôlés ici.
 */
#[ORM\Entity(repositoryClass: \App\Marketplace\Repository\AuctionRepository::class)]
#[ORM\Table(name: 'auction')]
class Auction
{
    public const MAX_START_PRICE = 1_000_000;
    public const MAX_BID = 10_000_000;

    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    #[ORM\Column(type: 'text')]
    private string $sellerId;

    #[ORM\Column]
    private int $carId;

    #[ORM\Column]
    private int $startPrice;

    #[ORM\Column(nullable: true)]
    private ?int $currentBid = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $bidderId = null;

    #[ORM\Column]
    private int $bidCount = 0;

    #[ORM\Column(type: 'auction_status')]
    private AuctionStatus $status = AuctionStatus::OPEN;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $endsAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $closedAt = null;

    /** @param list<int> $allowedDurations */
    public function __construct(string $sellerId, int $carId, int $startPrice, int $durationHours, array $allowedDurations, \DateTimeImmutable $now)
    {
        Guard::positiveInt($carId, 'Carte');
        Guard::positiveInt($startPrice, 'Prix de départ', self::MAX_START_PRICE);
        if (!\in_array($durationHours, $allowedDurations, true)) {
            throw new InvalidRequest(\sprintf('Durée invalide (%s heures)', implode(', ', $allowedDurations)));
        }
        $this->id = Uuid::v4()->toRfc4122();
        $this->sellerId = $sellerId;
        $this->carId = $carId;
        $this->startPrice = $startPrice;
        $this->createdAt = $now;
        $this->endsAt = $now->modify("+$durationHours hours");
    }

    /** Offre minimale : le prix de départ, puis +5 % (au moins 1 crédit) au-dessus de la meilleure offre. */
    public static function minimumAfter(int $startPrice, ?int $currentBid): int
    {
        return null === $currentBid ? $startPrice : $currentBid + max(1, (int) ceil($currentBid * 0.05));
    }

    public function minBid(): int
    {
        return self::minimumAfter($this->startPrice, $this->currentBid);
    }

    /**
     * Nouvelle offre ; renvoie le meilleur enchérisseur précédent (à rembourser).
     * Les crédits du nouvel enchérisseur sont bloqués par le service.
     *
     * @return array{userId: string, amount: int}|null
     */
    public function bid(string $userId, int $amount, \DateTimeImmutable $now, int $snipeSeconds): ?array
    {
        Guard::positiveInt($amount, 'Montant', self::MAX_BID);
        $this->assertRunning($now);
        if ($userId === $this->sellerId) {
            throw new InvalidRequest('Vous ne pouvez pas enchérir sur votre propre vente');
        }
        if ($userId === $this->bidderId) {
            throw new RuleViolation('Vous êtes déjà le meilleur enchérisseur');
        }
        $min = $this->minBid();
        if ($amount < $min) {
            throw new InvalidRequest("L’offre minimale est de $min crédits");
        }
        $previous = $this->bidderId ? ['userId' => $this->bidderId, 'amount' => $this->currentBid] : null;
        // Anti « dernière seconde » : une offre dans les N dernières secondes prolonge l'enchère jusqu'à N secondes.
        if ($this->endsAt->getTimestamp() - $now->getTimestamp() < $snipeSeconds) {
            $this->endsAt = $now->modify("+$snipeSeconds seconds");
        }
        $this->currentBid = $amount;
        $this->bidderId = $userId;
        ++$this->bidCount;

        return $previous;
    }

    /** Annulation par le vendeur, tant que personne n'a enchéri. */
    public function cancel(string $by, \DateTimeImmutable $now): void
    {
        if (AuctionStatus::OPEN !== $this->status) {
            throw new RuleViolation('Cette enchère est terminée');
        }
        if ($by !== $this->sellerId) {
            throw new Forbidden('Cette enchère ne vous appartient pas');
        }
        if ($this->bidCount > 0) {
            throw new RuleViolation('Impossible d’annuler : une offre a déjà été faite');
        }
        $this->status = AuctionStatus::CANCELLED;
        $this->closedAt = $now;
    }

    public function isDue(\DateTimeImmutable $now): bool
    {
        return AuctionStatus::OPEN === $this->status && $this->endsAt <= $now;
    }

    /**
     * Règlement à l'échéance : carte à l'acheteur, prix moins la commission au vendeur (la commission sort de l'économie).
     *
     * @return array{sold: bool, sellerId: string, buyerId: ?string, carId: int, price: ?int, fee: int, sellerProceeds: int}
     */
    public function settle(\DateTimeImmutable $now, int $feePercent): array
    {
        if (!$this->isDue($now)) {
            throw new RuleViolation('Cette enchère n’est pas terminée');
        }
        $this->closedAt = $now;
        if (!$this->bidderId || null === $this->currentBid) {
            $this->status = AuctionStatus::UNSOLD;

            return ['sold' => false, 'sellerId' => $this->sellerId, 'buyerId' => null, 'carId' => $this->carId, 'price' => null, 'fee' => 0, 'sellerProceeds' => 0];
        }
        $this->status = AuctionStatus::SOLD;
        $fee = intdiv($this->currentBid * $feePercent, 100);

        return ['sold' => true, 'sellerId' => $this->sellerId, 'buyerId' => $this->bidderId, 'carId' => $this->carId, 'price' => $this->currentBid, 'fee' => $fee, 'sellerProceeds' => $this->currentBid - $fee];
    }

    private function assertRunning(\DateTimeImmutable $now): void
    {
        if (AuctionStatus::OPEN !== $this->status || $this->endsAt <= $now) {
            throw new RuleViolation('Cette enchère est terminée');
        }
    }

    public function id(): string
    {
        return $this->id;
    }

    public function sellerId(): string
    {
        return $this->sellerId;
    }

    public function carId(): int
    {
        return $this->carId;
    }

    public function currentBid(): ?int
    {
        return $this->currentBid;
    }

    public function endsAt(): \DateTimeImmutable
    {
        return $this->endsAt;
    }
}
