<?php

declare(strict_types=1);

namespace App\Player\Controller;

use App\Catalog\Repository\CarRepository;
use App\Collection\Service\BoostersService;
use App\Identity\Entity\User;
use App\Shared\Config\GameSettings;
use App\Statistics\Service\PlayerStats;
use Doctrine\DBAL\Connection;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/** Profil du joueur connecté : vue composée à partir des différents contextes. */
#[AsController]
final class MeController
{
    public function __construct(
        private readonly BoostersService $boosters,
        private readonly PlayerStats $stats,
        private readonly CarRepository $cars,
        private readonly Connection $db,
        private readonly GameSettings $settings,
    ) {
    }

    #[Route('/me', methods: ['GET'])]
    public function me(#[CurrentUser] User $user): array
    {
        $id = $user->getId();

        return [
            'user' => ['id' => $id, 'name' => $user->getName(), 'email' => $user->getEmail(), 'image' => $user->getImage()],
            'boosters' => $this->boosters->status($id),
            'stats' => $this->stats->forUser($id) + [
                'catalogSize' => $this->cars->activeCount(),
                'achievements' => (int) $this->db->fetchOne('SELECT COUNT(*) FROM "user_achievement" WHERE "userId" = ?', [$id]),
            ],
            'game' => ['cardsPerBooster' => $this->settings->cardsPerBooster],
            'pity' => $this->boosters->pityCountdown($id),
        ];
    }
}
