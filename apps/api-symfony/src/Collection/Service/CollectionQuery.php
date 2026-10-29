<?php

declare(strict_types=1);

namespace App\Collection\Service;

use App\Catalog\Domain\Rarity;
use App\Catalog\Entity\Car;
use App\Catalog\View\CardView;
use App\Collection\Dto\CollectionFilter;
use App\Collection\Entity\UserCard;
use App\Shared\Domain\Iso;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;

/** Lecture : catalogue vu par un joueur (cartes possédées ou non) et progression par rareté et par marque. */
final class CollectionQuery
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Connection $db,
        private readonly CardView $view,
    ) {
    }

    /** @return array<string, mixed> */
    public function list(string $userId, CollectionFilter $f): array
    {
        // Requête DQL : jointure « à la main » entre deux contextes qui se référencent par identifiant.
        $qb = $this->em->createQueryBuilder()
            ->select('c', 'uc')
            ->from(Car::class, 'c')
            ->leftJoin(UserCard::class, 'uc', 'WITH', 'uc.carId = c.id AND uc.userId = :user')
            ->where('c.active = true')
            ->setParameter('user', $userId);
        if ($f->search) {
            $qb->andWhere('LOWER(c.name) LIKE :search OR LOWER(c.manufacturer) LIKE :search')
                ->setParameter('search', '%'.mb_strtolower(addcslashes($f->search, '%_\\')).'%');
        }
        if ($f->rarity) {
            $qb->andWhere('c.rarityOverride = :rarity OR (c.rarityOverride IS NULL AND c.rarity = :rarity)')->setParameter('rarity', Rarity::from($f->rarity));
        }
        if ($f->manufacturer) {
            $qb->andWhere('c.manufacturer = :manufacturer')->setParameter('manufacturer', $f->manufacturer);
        }
        if ($f->category) {
            $qb->andWhere('c.racing = :racing')->setParameter('racing', 'racing' === $f->category);
        }
        if ('owned' === $f->owned) {
            $qb->andWhere('uc.carId IS NOT NULL');
        } elseif ('missing' === $f->owned) {
            $qb->andWhere('uc.carId IS NULL');
        }
        match ($f->sort) {
            'name' => $qb->orderBy('c.name', 'ASC'),
            'year' => $qb->orderBy('c.yearStart', 'ASC')->addOrderBy('c.name', 'ASC'),
            'recent' => $qb->orderBy('c.createdAt', 'DESC')->addOrderBy('c.id', 'DESC'),
            default => $qb->orderBy('c.rarity', 'DESC')->addOrderBy('c.popularity', 'DESC')->addOrderBy('c.name', 'ASC'),
        };
        $total = (int) (clone $qb)->select('COUNT(c.id)')->resetDQLPart('orderBy')->getQuery()->getSingleScalarResult();
        $rows = $qb->setFirstResult(($f->page - 1) * $f->pageSize)->setMaxResults($f->pageSize)->getQuery()->getResult();

        $items = [];
        for ($i = 0; $i < \count($rows); ++$i) {
            $row = $rows[$i];
            if (!$row instanceof Car) {
                continue;
            }
            $owned = ($rows[$i + 1] ?? null) instanceof UserCard ? $rows[$i + 1] : null;
            $items[] = $this->view->card($row) + ['quantity' => $owned?->quantity() ?? 0, 'firstObtainedAt' => Iso::format($owned?->firstObtainedAt())];
        }

        return ['page' => $f->page, 'pageSize' => $f->pageSize, 'total' => $total, 'pages' => max(1, (int) ceil($total / $f->pageSize)), 'items' => $items];
    }

    /** @return array<string, mixed> */
    public function summary(string $userId): array
    {
        $rows = $this->db->fetchAllAssociative(<<<'SQL'
            SELECT COALESCE(c."rarityOverride", c."rarity")::text AS rarity, COUNT(*) AS total, COUNT(uc."carId") AS owned
            FROM "car" c LEFT JOIN "user_card" uc ON uc."carId" = c."id" AND uc."userId" = :id
            WHERE c."active" = true GROUP BY 1
            SQL, ['id' => $userId]);
        $byRarity = array_column($rows, null, 'rarity');
        $brands = $this->db->fetchAllAssociative(<<<'SQL'
            SELECT c."manufacturer", COUNT(*) AS total, COUNT(uc."carId") AS owned
            FROM "car" c LEFT JOIN "user_card" uc ON uc."carId" = c."id" AND uc."userId" = :id
            WHERE c."active" = true AND c."manufacturer" IS NOT NULL
            GROUP BY c."manufacturer" ORDER BY COUNT(*) DESC, c."manufacturer" ASC
            SQL, ['id' => $userId]);

        return [
            'rarities' => array_map(static fn (Rarity $r) => [
                'rarity' => $r->value,
                'label' => $r->label(),
                'points' => $r->points(),
                'total' => (int) ($byRarity[$r->value]['total'] ?? 0),
                'owned' => (int) ($byRarity[$r->value]['owned'] ?? 0),
            ], Rarity::cases()),
            'manufacturers' => array_map(static fn (array $b) => ['name' => $b['manufacturer'], 'total' => (int) $b['total'], 'owned' => (int) $b['owned']], $brands),
        ];
    }
}
