<?php

declare(strict_types=1);

namespace App\Games\Repository;

use App\Games\Domain\GameStatus;
use App\Games\Domain\GameType;
use App\Games\Entity\GameSession;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<GameSession> */
final class GameSessionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GameSession::class);
    }

    public function findActive(string $userId, GameType $type): ?GameSession
    {
        return $this->findOneBy(['userId' => $userId, 'type' => $type, 'status' => GameStatus::ACTIVE], ['createdAt' => 'DESC']);
    }

    /** Partie du joueur (null si elle n'existe pas ou appartient à un autre joueur). */
    public function findForPlayer(string $id, string $userId): ?GameSession
    {
        return $this->findOneBy(['id' => $id, 'userId' => $userId]);
    }

    /** Partie du joueur verrouillée pour la réponse (une seule réponse traitée par manche). */
    public function getForUpdate(string $id, string $userId): ?GameSession
    {
        $session = $this->findForPlayer($id, $userId);
        if ($session) {
            $this->getEntityManager()->refresh($session, LockMode::PESSIMISTIC_WRITE);
        }

        return $session;
    }

    public function countStartedSince(string $userId, GameType $type, \DateTimeImmutable $since): int
    {
        return (int) $this->createQueryBuilder('g')->select('COUNT(g.id)')
            ->where('g.userId = :user AND g.type = :type AND g.createdAt >= :since')
            ->setParameter('user', $userId)->setParameter('type', $type, 'game_type')->setParameter('since', $since, 'datetime_immutable')
            ->getQuery()->getSingleScalarResult();
    }

    public function bestScore(string $userId, GameType $type): int
    {
        return (int) $this->createQueryBuilder('g')->select('MAX(g.score)')
            ->where('g.userId = :user AND g.type = :type AND g.status = :finished')
            ->setParameter('user', $userId)->setParameter('type', $type, 'game_type')->setParameter('finished', GameStatus::FINISHED, 'game_status')
            ->getQuery()->getSingleScalarResult();
    }
}
