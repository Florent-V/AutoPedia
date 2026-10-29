<?php

declare(strict_types=1);

namespace App\Marketplace\Controller;

use App\Marketplace\Dto\CreateTradeInput;
use App\Marketplace\Dto\TradeListFilter;
use App\Marketplace\Service\MarketQueries;
use App\Marketplace\Service\TradesService;
use App\Shared\Http\Ids;
use App\Shared\Http\Payload;
use App\Shared\Http\Status;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/trades')]
final class TradesController
{
    public function __construct(
        private readonly TradesService $trades,
        private readonly MarketQueries $queries,
        private readonly WonCard $wonCard,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function list(#[CurrentUser] UserInterface $user, #[Payload('query')] TradeListFilter $filter): array
    {
        return $this->queries->trades($user->getUserIdentifier(), $filter);
    }

    #[Route('', methods: ['POST'])]
    #[Status(201)]
    public function create(#[CurrentUser] UserInterface $user, #[Payload] CreateTradeInput $input): array
    {
        return $this->trades->create($user->getUserIdentifier(), $input->offeredCarId, $input->wantedCarId, $input->price);
    }

    #[Route('/{id}/accept', methods: ['POST'])]
    public function accept(#[CurrentUser] UserInterface $user, string $id): array
    {
        $won = $this->trades->accept($user->getUserIdentifier(), Ids::uuid($id));

        return ['card' => ($this->wonCard)($won), 'balance' => $won['balance'], 'tradeId' => $won['tradeId']];
    }

    #[Route('/{id}/cancel', methods: ['POST'])]
    public function cancel(#[CurrentUser] UserInterface $user, string $id): array
    {
        return $this->trades->cancel($user->getUserIdentifier(), Ids::uuid($id));
    }
}
