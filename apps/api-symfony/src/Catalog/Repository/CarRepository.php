<?php

declare(strict_types=1);

namespace App\Catalog\Repository;

use App\Catalog\Domain\Rarity;
use App\Catalog\Entity\Car;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Car> */
final class CarRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Car::class);
    }

    /**
     * Carte active au hasard de la rareté voulue, sinon de la plus proche ; hors `$exclude` si possible.
     *
     * @param list<int> $exclude
     */
    public function random(Rarity $wanted, array $exclude = []): ?Car
    {
        $sql = 'SELECT "id" FROM "car" WHERE "active" = true AND COALESCE("rarityOverride", "rarity") = CAST(:rarity AS "Rarity")
                AND NOT ("id" = ANY(CAST(:exclude AS int[]))) ORDER BY random() LIMIT 1';
        foreach ([$exclude, []] as $excluded) {
            foreach ($wanted->nearest() as $rarity) {
                $id = $this->getEntityManager()->getConnection()->fetchOne($sql, [
                    'rarity' => $rarity->value,
                    'exclude' => '{'.implode(',', array_map('intval', $excluded)).'}',
                ]);
                if (false !== $id) {
                    return $this->find((int) $id);
                }
            }
        }

        return null;
    }

    /**
     * @param list<int> $ids
     *
     * @return array<int, Car> indexées par identifiant
     */
    public function byIds(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $cars = $this->createQueryBuilder('c')->where('c.id IN (:ids)')->setParameter('ids', array_values(array_unique($ids)))->getQuery()->getResult();
        $byId = [];
        foreach ($cars as $car) {
            $byId[$car->getId()] = $car;
        }

        return $byId;
    }

    public function activeExists(int $id): bool
    {
        return (bool) $this->count(['id' => $id, 'active' => true]);
    }

    public function activeCount(): int
    {
        return $this->count(['active' => true]);
    }

    /** @return array<string, list<int>> identifiants des cartes actives par rareté effective (programme de la boutique) */
    public function activeIdsByRarity(): array
    {
        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT "id", COALESCE("rarityOverride", "rarity")::text AS rarity FROM "car" WHERE "active" = true',
        );
        $pool = [];
        foreach ($rows as $row) {
            $pool[$row['rarity']][] = (int) $row['id'];
        }

        return $pool;
    }
}
