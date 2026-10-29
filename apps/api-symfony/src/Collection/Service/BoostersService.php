<?php

declare(strict_types=1);

namespace App\Collection\Service;

use App\Collection\Domain\BoosterRules;
use App\Collection\Entity\BoosterOpening;
use App\Collection\Event\BoosterOpened;
use App\Player\Repository\PlayerRepository;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\Random;
use App\Shared\Transaction\UnitOfWork;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

final class BoostersService
{
    private readonly BoosterRules $rules;

    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly CardsService $cards,
        private readonly EntityManagerInterface $em,
        private readonly ClockInterface $clock,
        private readonly Random $random,
        GameSettings $settings,
    ) {
        $this->rules = BoosterRules::from($settings);
    }

    /** @return array<string, mixed> */
    public function status(string $userId): array
    {
        $now = $this->now();

        return $this->players->get($userId)->reserve()->status($now, $this->rules)->view($now);
    }

    /** @return array{epicIn: int, legendaryIn: int} */
    public function pityCountdown(string $userId): array
    {
        return $this->players->get($userId)->reserve()->pityCountdown($this->rules);
    }

    /**
     * Ouvre un booster : tout est décidé ici (raretés, cartes, garanties), le client n'envoie rien.
     *
     * @return array{cards: list<array{carId: int, quantity: int, isNew: bool}>, boosters: array<string, mixed>, pity: array{epic: bool, legendary: bool}}
     */
    public function open(string $userId): array
    {
        return $this->uow->run(function () use ($userId) {
            $player = $this->players->lock($userId)[$userId];
            $now = $this->now();
            $reserve = $player->reserve();
            $pity = $reserve->pity($this->rules);
            $after = $reserve->consume($now, $this->rules);

            $drawn = [];
            foreach ($pity->rollBooster($this->rules->cardsPerBooster, $this->random) as $rarity) {
                // Pas de doublon au sein d'un même booster.
                $drawn[] = $this->cards->draw($rarity, array_map(static fn ($c) => $c->getId(), $drawn));
            }
            $reserve->recordOpening(array_map(static fn ($c) => $c->effectiveRarity(), $drawn));

            $cards = array_map(fn ($car) => $this->cards->grant($userId, $car->getId()), $drawn);
            $ids = array_map(static fn ($c) => $c->getId(), $drawn);
            $this->em->persist(new BoosterOpening($userId, $ids, $now));
            $this->uow->publish(new BoosterOpened($userId, $ids));

            return ['cards' => $cards, 'boosters' => $after->view($now), 'pity' => $pity->toArray()];
        });
    }

    /** Offre des boosters (récompense quotidienne) ; la réserve peut dépasser le maximum. Joueur verrouillé. */
    public function grant(string $userId, int $count): array
    {
        $now = $this->now();

        return $this->players->get($userId)->reserve()->grant($count, $now, $this->rules)->view($now);
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
