<?php

declare(strict_types=1);

namespace App\Wallet\Entity;

use App\Wallet\Domain\LedgerEntry;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Ligne du journal des crédits (positif = gain, négatif = dépense), avec le solde obtenu. */
#[ORM\Entity]
#[ORM\Table(name: 'credit_transaction')]
class CreditTransaction
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    #[ORM\Column(type: 'text')]
    private string $userId;

    #[ORM\Column]
    private int $amount;

    #[ORM\Column(type: 'text')]
    private string $reason;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $ref;

    #[ORM\Column]
    private int $balance;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $userId, LedgerEntry $entry, \DateTimeImmutable $now)
    {
        $this->id = Uuid::v4()->toRfc4122();
        $this->userId = $userId;
        $this->amount = $entry->amount;
        $this->reason = $entry->reason->value;
        $this->ref = $entry->ref;
        $this->balance = $entry->balance;
        $this->createdAt = $now;
    }
}
