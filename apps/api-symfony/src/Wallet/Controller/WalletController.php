<?php

declare(strict_types=1);

namespace App\Wallet\Controller;

use App\Shared\Domain\Iso;
use App\Wallet\Domain\LedgerReason;
use Doctrine\DBAL\Connection;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Core\User\UserInterface;

#[AsController]
final class WalletController
{
    public function __construct(private readonly Connection $db)
    {
    }

    /** Solde et 30 derniers mouvements de crédits (lecture directe : CQRS léger). */
    #[Route('/wallet', methods: ['GET'])]
    public function wallet(#[CurrentUser] UserInterface $user): array
    {
        $id = $user->getUserIdentifier();
        $player = $this->db->fetchAssociative('SELECT "credits", "creditsEarned" FROM "player" WHERE "userId" = ?', [$id]) ?: ['credits' => 0, 'creditsEarned' => 0];
        $rows = $this->db->fetchAllAssociative('SELECT * FROM "credit_transaction" WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 30', [$id]);

        return [
            'balance' => (int) $player['credits'],
            'earned' => (int) $player['creditsEarned'],
            'history' => array_map(static fn (array $r) => [
                'id' => $r['id'],
                'userId' => $r['userId'],
                'amount' => (int) $r['amount'],
                'reason' => $r['reason'],
                'ref' => $r['ref'],
                'balance' => (int) $r['balance'],
                'createdAt' => Iso::format(new \DateTimeImmutable($r['createdAt'], new \DateTimeZone('UTC'))),
                'label' => LedgerReason::tryFrom($r['reason'])?->label() ?? $r['reason'],
            ], $rows),
        ];
    }
}
