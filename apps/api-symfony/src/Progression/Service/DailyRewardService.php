<?php

declare(strict_types=1);

namespace App\Progression\Service;

use App\Catalog\Domain\Rarity;
use App\Collection\Service\BoostersService;
use App\Collection\Service\CardsService;
use App\Player\Repository\PlayerRepository;
use App\Progression\Domain\DailyReward;
use App\Shared\Domain\GameCalendar;
use App\Shared\Domain\Iso;
use App\Shared\Domain\Random;
use App\Shared\Transaction\UnitOfWork;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Psr\Clock\ClockInterface;

final class DailyRewardService
{
    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly WalletService $wallet,
        private readonly BoostersService $boosters,
        private readonly CardsService $cards,
        private readonly AchievementService $achievements,
        private readonly GameCalendar $calendar,
        private readonly ClockInterface $clock,
        private readonly Random $random,
    ) {
    }

    /** @return array<string, mixed> */
    public function status(string $userId): array
    {
        $now = $this->now();
        $s = $this->players->get($userId)->streak()->status($this->calendar->day($now), $this->calendar->yesterday($now));

        return [
            'canClaim' => $s['canClaim'],
            'streak' => $s['streak'],
            'bestStreak' => $s['best'],
            'day' => $s['day'],
            'resetsAt' => Iso::format($this->calendar->nextDay($now)),
            'rewards' => array_map(static fn (DailyReward $r) => $r->toArray(), DailyReward::cycle()),
        ];
    }

    /** @return array<string, mixed> */
    public function claim(string $userId): array
    {
        return $this->uow->run(function () use ($userId) {
            $player = $this->players->lock($userId)[$userId];
            $now = $this->now();
            // Dates de l'horloge du serveur, dans le fuseau du jeu : le client n'a aucune prise dessus.
            $reward = $player->streak()->claim($this->calendar->day($now), $this->calendar->yesterday($now));
            // Boosters offerts : ils s'ajoutent à la réserve, au-delà du maximum si besoin.
            $boosters = $reward->boosters ? $this->boosters->grant($userId, $reward->boosters) : $this->boosters->status($userId);
            if ($reward->credits) {
                $this->wallet->credit($userId, $reward->credits, LedgerReason::DAILY, 'jour-'.$reward->day);
            }
            $card = null;
            if ($reward->topCard) {
                $car = $this->cards->draw($this->random->next() < 0.2 ? Rarity::LEGENDARY : Rarity::EPIC);
                $card = $this->cards->grant($userId, $car->getId());
            }
            $this->achievements->evaluate($userId);

            return [
                'day' => $reward->day,
                'streak' => $player->streak()->current(),
                'reward' => $reward->toArray(),
                'card' => $card,
                'balance' => $player->wallet()->balance(),
                'boosters' => $boosters,
            ];
        });
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
