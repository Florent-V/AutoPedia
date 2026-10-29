<?php

declare(strict_types=1);

namespace App\Marketplace\Controller;

use App\Marketplace\Dto\AuctionListFilter;
use App\Marketplace\Dto\BidInput;
use App\Marketplace\Dto\CreateAuctionInput;
use App\Marketplace\Service\AuctionsService;
use App\Marketplace\Service\MarketQueries;
use App\Shared\Http\Ids;
use App\Shared\Http\Payload;
use App\Shared\Http\Status;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/auctions')]
final class AuctionsController
{
    public function __construct(
        private readonly AuctionsService $auctions,
        private readonly MarketQueries $queries,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function list(#[CurrentUser] UserInterface $user, #[Payload('query')] AuctionListFilter $filter): array
    {
        return $this->queries->auctions($user->getUserIdentifier(), $filter);
    }

    #[Route('', methods: ['POST'])]
    #[Status(201)]
    public function create(#[CurrentUser] UserInterface $user, #[Payload] CreateAuctionInput $input): array
    {
        return $this->auctions->create($user->getUserIdentifier(), $input->carId, $input->startPrice, $input->durationHours);
    }

    #[Route('/{id}/bid', methods: ['POST'])]
    public function bid(#[CurrentUser] UserInterface $user, string $id, #[Payload] BidInput $input): array
    {
        return $this->auctions->bid($user->getUserIdentifier(), Ids::uuid($id), $input->amount);
    }

    #[Route('/{id}/cancel', methods: ['POST'])]
    public function cancel(#[CurrentUser] UserInterface $user, string $id): array
    {
        return $this->auctions->cancel($user->getUserIdentifier(), Ids::uuid($id));
    }
}
