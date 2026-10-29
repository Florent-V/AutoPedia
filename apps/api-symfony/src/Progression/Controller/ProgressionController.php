<?php

declare(strict_types=1);

namespace App\Progression\Controller;

use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;
use App\Progression\Service\AchievementService;
use App\Progression\Service\DailyRewardService;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
final class ProgressionController
{
    public function __construct(
        private readonly AchievementService $achievements,
        private readonly DailyRewardService $daily,
        private readonly CarRepository $cars,
        private readonly CardView $view,
    ) {
    }

    #[Route('/achievements', methods: ['GET'])]
    public function achievements(#[CurrentUser] UserInterface $user): array
    {
        return $this->achievements->list($user->getUserIdentifier());
    }

    #[Route('/daily', methods: ['GET'])]
    public function daily(#[CurrentUser] UserInterface $user): array
    {
        return $this->daily->status($user->getUserIdentifier());
    }

    #[Route('/daily/claim', methods: ['POST'])]
    public function claim(#[CurrentUser] UserInterface $user): array
    {
        $result = $this->daily->claim($user->getUserIdentifier());
        $won = $result['card'];
        $car = $won ? $this->cars->find($won['carId']) : null;
        $result['card'] = $car ? $this->view->card($car) + ['quantity' => $won['quantity'], 'isNew' => $won['isNew']] : null;

        return $result;
    }
}
