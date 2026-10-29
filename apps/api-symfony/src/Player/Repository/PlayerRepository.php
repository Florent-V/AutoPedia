<?php

declare(strict_types=1);

namespace App\Player\Repository;

use App\Player\Entity\Player;
use App\Shared\Domain\Exception\NotFound;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Player> */
final class PlayerRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Player::class);
    }

    public function get(string $userId): Player
    {
        return $this->find($userId) ?? throw new NotFound('Joueur introuvable');
    }

    /**
     * Verrouille les joueurs (SELECT … FOR UPDATE, verrou pessimiste Doctrine) dans la transaction en cours,
     * toujours dans le même ordre (pas d'interblocage), et les relit sous verrou.
     * Les modifications en attente sont d'abord écrites : la relecture ne perd rien.
     *
     * @return array<string, Player>
     */
    public function lock(string ...$userIds): array
    {
        $em = $this->getEntityManager();
        $em->flush();
        $ids = array_values(array_unique($userIds));
        sort($ids);
        $players = [];
        foreach ($ids as $id) {
            $player = $this->find($id) ?? throw new NotFound('Joueur introuvable');
            $em->refresh($player, LockMode::PESSIMISTIC_WRITE);
            $players[$id] = $player;
        }

        return $players;
    }
}
