<?php

declare(strict_types=1);

namespace App\Wallet\Service;

use App\Player\Entity\Player;
use App\Player\Repository\PlayerRepository;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Entity\CreditTransaction;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/**
 * Point d'entrée des autres contextes pour les crédits. À appeler dans une unité de travail,
 * après avoir verrouillé les joueurs concernés (PlayerRepository::lock).
 */
final class WalletService
{
    public function __construct(
        private readonly PlayerRepository $players,
        private readonly EntityManagerInterface $em,
        private readonly ClockInterface $clock,
    ) {
    }

    public function balance(string $userId): int
    {
        return $this->players->get($userId)->wallet()->balance();
    }

    /** Verse des crédits ; renvoie le nouveau solde. */
    public function credit(string $userId, int $amount, LedgerReason $reason, ?string $ref = null): int
    {
        $player = $this->players->get($userId);
        $player->wallet()->credit($amount, $reason, $ref);

        return $this->record($player);
    }

    /** Prélève des crédits (409 si le solde ne suffit pas) ; renvoie le nouveau solde. */
    public function debit(string $userId, int $amount, LedgerReason $reason, ?string $ref = null): int
    {
        $player = $this->players->get($userId);
        $player->wallet()->debit($amount, $reason, $ref);

        return $this->record($player);
    }

    private function record(Player $player): int
    {
        $now = \DateTimeImmutable::createFromInterface($this->clock->now());
        foreach ($player->wallet()->pullEntries() as $entry) {
            $this->em->persist(new CreditTransaction($player->userId(), $entry, $now));
        }

        return $player->wallet()->balance();
    }
}
