<?php

declare(strict_types=1);

namespace App\Marketplace\Controller;

use App\Marketplace\Dto\BuyInput;
use App\Marketplace\Service\MarketQueries;
use App\Marketplace\Service\ShopService;
use App\Shared\Http\Payload;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/shop')]
final class ShopController
{
    public function __construct(
        private readonly ShopService $shop,
        private readonly MarketQueries $queries,
        private readonly WonCard $wonCard,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function list(#[CurrentUser] UserInterface $user): array
    {
        return $this->queries->shop($user->getUserIdentifier());
    }

    #[Route('/buy', methods: ['POST'])]
    public function buy(#[CurrentUser] UserInterface $user, #[Payload] BuyInput $input): array
    {
        $won = $this->shop->buy($user->getUserIdentifier(), $input->offerKey);

        return ['card' => ($this->wonCard)($won), 'balance' => $won['balance']];
    }
}
