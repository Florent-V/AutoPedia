<?php

declare(strict_types=1);

namespace App\Marketplace\Repository;

use App\Marketplace\Domain\AuctionStatus;
use App\Marketplace\Entity\Auction;
use App\Shared\Domain\Exception\NotFound;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Auction> */
final class AuctionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Auction::class);
    }

    /** Enchère verrouillée (SELECT … FOR UPDATE) ; 404 si elle n'existe pas. */
    public function getForUpdate(string $id): Auction
    {
        return $this->find($id, LockMode::PESSIMISTIC_WRITE) ?? throw new NotFound('Enchère introuvable');
    }

    public function countOpenBySeller(string $sellerId): int
    {
        return $this->count(['sellerId' => $sellerId, 'status' => AuctionStatus::OPEN]);
    }

    /** @return list<string> */
    public function dueIds(\DateTimeImmutable $now, int $limit): array
    {
        return array_column($this->createQueryBuilder('a')->select('a.id')
            ->where('a.status = :open AND a.endsAt <= :now')
            ->setParameter('open', AuctionStatus::OPEN, 'auction_status')->setParameter('now', $now, 'datetime_immutable')
            ->setMaxResults($limit)->getQuery()->getArrayResult(), 'id');
    }
}
