<?php

declare(strict_types=1);

namespace App\Collection\Controller;

use App\Collection\Dto\CollectionFilter;
use App\Collection\Service\CollectionQuery;
use App\Shared\Http\Payload;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/collection')]
final class CollectionController
{
    public function __construct(private readonly CollectionQuery $collection)
    {
    }

    #[Route('', methods: ['GET'])]
    public function list(#[CurrentUser] UserInterface $user, #[Payload('query')] CollectionFilter $filter): array
    {
        return $this->collection->list($user->getUserIdentifier(), $filter);
    }

    #[Route('/summary', methods: ['GET'])]
    public function summary(#[CurrentUser] UserInterface $user): array
    {
        return $this->collection->summary($user->getUserIdentifier());
    }
}
