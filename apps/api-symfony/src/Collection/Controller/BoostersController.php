<?php

declare(strict_types=1);

namespace App\Collection\Controller;

use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;
use App\Collection\Service\BoostersService;
use App\Statistics\Service\PlayerStats;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/boosters')]
final class BoostersController
{
    public function __construct(
        private readonly BoostersService $boosters,
        private readonly CarRepository $cars,
        private readonly CardView $view,
        private readonly PlayerStats $stats,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function status(#[CurrentUser] UserInterface $user): array
    {
        return $this->boosters->status($user->getUserIdentifier());
    }

    /** Aucun paramètre : le contenu du booster est entièrement décidé par le serveur. */
    #[Route('/open', methods: ['POST'])]
    public function open(#[CurrentUser] UserInterface $user): array
    {
        $result = $this->boosters->open($user->getUserIdentifier());
        $cars = $this->cars->byIds(array_column($result['cards'], 'carId'));

        return [
            'cards' => array_map(fn (array $c) => $this->view->card($cars[$c['carId']]) + ['quantity' => $c['quantity'], 'isNew' => $c['isNew']], $result['cards']),
            'boosters' => $result['boosters'],
            'stats' => $this->stats->forUser($user->getUserIdentifier()),
            'pity' => $result['pity'],
        ];
    }
}
