<?php

declare(strict_types=1);

namespace App\Collection\Service;

use App\Catalog\Domain\Rarity;
use App\Catalog\Entity\Car;
use App\Catalog\Repository\CarRepository;
use App\Collection\Entity\UserCard;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\Unavailable;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/**
 * Point d'entrée des autres contextes pour les cartes des joueurs (gains, séquestre, tirages).
 * À appeler dans une unité de travail, joueur verrouillé.
 */
final class CardsService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CarRepository $cars,
        private readonly ClockInterface $clock,
    ) {
    }

    /**
     * Donne un exemplaire d'une carte.
     *
     * @return array{carId: int, quantity: int, isNew: bool}
     */
    public function grant(string $userId, int $carId): array
    {
        $now = \DateTimeImmutable::createFromInterface($this->clock->now());
        $card = $this->em->find(UserCard::class, ['userId' => $userId, 'carId' => $carId]);
        $isNew = null === $card;
        if ($isNew) {
            $card = new UserCard($userId, $carId, $now);
            $this->em->persist($card);
        } else {
            $card->addOne($now);
        }

        return ['carId' => $carId, 'quantity' => $card->quantity(), 'isNew' => $isNew];
    }

    /** Retire un exemplaire (mise en séquestre, échange) ; 400 si le joueur ne la possède pas. */
    public function take(string $userId, int $carId): void
    {
        $card = $this->em->find(UserCard::class, ['userId' => $userId, 'carId' => $carId]);
        if (!$card) {
            throw new InvalidRequest('Vous ne possédez pas cette carte');
        }
        if (!$card->removeOne()) {
            $this->em->remove($card);
        }
    }

    /** @return array{quantity: int, firstObtainedAt: ?\DateTimeImmutable} */
    public function ownership(string $userId, int $carId): array
    {
        $card = $this->em->find(UserCard::class, ['userId' => $userId, 'carId' => $carId]);

        return ['quantity' => $card?->quantity() ?? 0, 'firstObtainedAt' => $card?->firstObtainedAt()];
    }

    /**
     * Tire une carte au hasard de la rareté demandée (ou de la plus proche), hors $exclude si possible.
     *
     * @param list<int> $exclude
     */
    public function draw(Rarity $rarity, array $exclude = []): Car
    {
        return $this->cars->random($rarity, $exclude)
            ?? throw new Unavailable("Le catalogue de cartes est vide : lancez l'import (voir README) puis réessayez.");
    }
}
