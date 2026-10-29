<?php

declare(strict_types=1);

namespace App\Collection\Controller;

use App\Catalog\Service\CarDetail;
use App\Collection\Service\CardsService;
use App\Shared\Domain\Iso;
use App\Shared\Http\Ids;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/** Fiche d'une carte vue par le joueur : données du catalogue + exemplaires possédés. */
#[AsController]
final class CarsController
{
    public function __construct(private readonly CarDetail $cars, private readonly CardsService $cards)
    {
    }

    #[Route('/cars/{id}', methods: ['GET'])]
    public function detail(#[CurrentUser] UserInterface $user, string $id): array
    {
        $carId = Ids::int($id);
        $owned = $this->cards->ownership($user->getUserIdentifier(), $carId);

        return $this->cars->detail($carId) + ['quantity' => $owned['quantity'], 'firstObtainedAt' => Iso::format($owned['firstObtainedAt'])];
    }
}
