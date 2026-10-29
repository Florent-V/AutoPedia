<?php

declare(strict_types=1);

namespace App\Games\Controller;

use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;
use App\Games\Domain\GameType;
use App\Games\Dto\AnswerInput;
use App\Games\Service\GamesService;
use App\Shared\Http\Ids;
use App\Shared\Http\Payload;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/games')]
final class GamesController
{
    public function __construct(
        private readonly GamesService $games,
        private readonly CarRepository $cars,
        private readonly CardView $view,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function overview(#[CurrentUser] UserInterface $user): array
    {
        return $this->games->overview($user->getUserIdentifier());
    }

    #[Route('/{type}/start', methods: ['POST'])]
    public function start(#[CurrentUser] UserInterface $user, string $type): array
    {
        $game = GameType::tryFrom($type) ?? throw new BadRequestHttpException('Jeu inconnu');

        return $this->games->start($user->getUserIdentifier(), $game);
    }

    #[Route('/sessions/{id}', methods: ['GET'])]
    public function get(#[CurrentUser] UserInterface $user, string $id): array
    {
        return $this->games->get($user->getUserIdentifier(), Ids::uuid($id));
    }

    #[Route('/sessions/{id}/answer', methods: ['POST'])]
    public function answer(#[CurrentUser] UserInterface $user, string $id, #[Payload] AnswerInput $input): array
    {
        $result = $this->games->answer($user->getUserIdentifier(), Ids::uuid($id), $input->choice);
        $ids = array_filter([$result['prize']['carId'] ?? null, $result['bonus']['carId'] ?? null, ...array_column($result['doors'] ?? [], 'carId')]);
        $cars = $this->cars->byIds(array_values($ids));
        $card = fn (?array $won) => $won && isset($cars[$won['carId']]) ? $this->view->card($cars[$won['carId']]) + ['quantity' => $won['quantity'], 'isNew' => $won['isNew']] : null;
        $prize = $card($result['prize']);

        return [
            'correct' => $result['correct'],
            'answer' => $result['answer'],
            'reveal' => $result['reveal'],
            // Contenu des trois portes, révélé après le choix.
            'doors' => null === $result['doors'] ? null : array_map(fn (array $d) => ['tier' => $d['tier'], 'card' => $d['carId'] ? $this->view->card($cars[$d['carId']]) : null], $result['doors']),
            'prize' => $prize,
            'gained' => $result['gained'],
            'balance' => $result['balance'],
            'session' => $result['session'],
            'summary' => $result['finished'] ? ['score' => $result['session']['score'], 'credits' => $result['session']['credits'], 'rewardCard' => $card($result['bonus']), 'prize' => $prize] : null,
        ];
    }
}
