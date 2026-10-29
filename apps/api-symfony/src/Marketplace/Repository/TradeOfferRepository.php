<?php

declare(strict_types=1);

namespace App\Marketplace\Repository;

use App\Marketplace\Domain\TradeStatus;
use App\Marketplace\Entity\TradeOffer;
use App\Shared\Domain\Exception\NotFound;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<TradeOffer> */
final class TradeOfferRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TradeOffer::class);
    }

    /** Offre verrouillée (SELECT … FOR UPDATE) ; 404 si elle n'existe pas. */
    public function getForUpdate(string $id): TradeOffer
    {
        return $this->find($id, LockMode::PESSIMISTIC_WRITE) ?? throw new NotFound('Offre introuvable');
    }

    public function countOpenBySeller(string $sellerId): int
    {
        return $this->count(['sellerId' => $sellerId, 'status' => TradeStatus::OPEN]);
    }

    /** @return list<string> */
    public function expiredIds(\DateTimeImmutable $now, int $limit): array
    {
        return array_column($this->createQueryBuilder('t')->select('t.id')
            ->where('t.status = :open AND t.expiresAt <= :now')
            ->setParameter('open', TradeStatus::OPEN, 'trade_status')->setParameter('now', $now, 'datetime_immutable')
            ->setMaxResults($limit)->getQuery()->getArrayResult(), 'id');
    }
}
