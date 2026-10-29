<?php

declare(strict_types=1);

namespace App\Games\Service;

use App\Catalog\Domain\Rarity;
use App\Collection\Service\CardsService;
use App\Games\Domain\GameType;
use App\Games\Domain\QuestionFactory;
use App\Games\Entity\GameSession;
use App\Games\Event\GameRoundPlayed;
use App\Games\Repository\GameSessionRepository;
use App\Player\Repository\PlayerRepository;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\Exception\NotFound;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Domain\Exception\Unavailable;
use App\Shared\Domain\GameCalendar;
use App\Shared\Domain\Iso;
use App\Shared\Domain\Random;
use App\Shared\Transaction\UnitOfWork;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

final class GamesService
{
    /** Abandon automatique d'une partie restée ouverte. */
    private const ABANDON_AFTER_SECONDS = 3600;

    public function __construct(
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly GameSessionRepository $sessions,
        private readonly QuestionFactory $questions,
        private readonly WalletService $wallet,
        private readonly CardsService $cards,
        private readonly EntityManagerInterface $em,
        private readonly GameSettings $settings,
        private readonly GameCalendar $calendar,
        private readonly ClockInterface $clock,
        private readonly Random $random,
    ) {
    }

    /** Une partie par jeu et par jour au plus : la manche de départ est tirée ici, jamais par le client. */
    public function start(string $userId, GameType $type): array
    {
        return $this->uow->run(function () use ($userId, $type) {
            $this->players->lock($userId);
            $now = $this->now();
            $def = $type->def($this->settings);
            // Une partie en cours de ce jeu est reprise plutôt que d'en commencer une nouvelle.
            $active = $this->sessions->findActive($userId, $type);
            if ($active && !$active->isStale($now, self::ABANDON_AFTER_SECONDS)) {
                return $active->view($def);
            }
            $active?->finish($now);

            $played = $this->sessions->countStartedSince($userId, $type, $this->calendar->startOfDay($now));
            if ($played >= $def->playsPerDay) {
                throw new RuleViolation('Plus de partie disponible aujourd’hui pour ce jeu : revenez demain !');
            }
            $first = $this->questions->make($type, []) ?? throw new Unavailable('Pas assez de cartes dans le catalogue pour ce jeu');
            $session = new GameSession($userId, $type, $first, $now);
            $this->em->persist($session);

            return $session->view($def);
        });
    }

    public function get(string $userId, string $id): array
    {
        $session = $this->sessions->findForPlayer($id, $userId) ?? throw new NotFound('Partie introuvable');

        return $session->view($session->type()->def($this->settings));
    }

    /**
     * Répond à la manche en cours : le serveur juge avec la manche qu'il a gardée, verse les gains
     * et prépare la manche suivante. Verrous : joueur puis partie (même ordre qu'au démarrage).
     *
     * @return array<string, mixed>
     */
    public function answer(string $userId, string $id, mixed $choice): array
    {
        return $this->uow->run(function () use ($userId, $id, $choice) {
            $player = $this->players->lock($userId)[$userId];
            $session = $this->sessions->getForUpdate($id, $userId) ?? throw new NotFound('Partie introuvable');
            $def = $session->type()->def($this->settings);
            $now = $this->now();
            $outcome = $session->answer($choice, $def);

            if ($outcome['gained']) {
                $this->wallet->credit($userId, $outcome['gained'], GameType::DUEL === $session->type() ? LedgerReason::GAME_DUEL : LedgerReason::GAME_QUIZ, $session->id());
            }
            $prize = null;
            if ($outcome['prizeCarId']) {
                $prize = $this->cards->grant($userId, $outcome['prizeCarId']);
                ++$player->activity()->gameCardsWon;
                if ($outcome['jackpot']) {
                    ++$player->activity()->doorsJackpots;
                }
            }
            $session->continueWith($outcome['continues'] ? $this->questions->make($session->type(), $session->usedCars()) : null, $now);

            $bonus = null;
            if ($session->earnedPerfectBonus($def)) {
                // Sans-faute : une carte bonus (peu commune ou mieux).
                $car = $this->cards->draw(Rarity::roll(true, $this->random));
                $bonus = $this->cards->grant($userId, $car->getId());
                $session->setBonusCard($car->getId());
                ++$player->activity()->gameCardsWon;
            }
            if ($session->isFinished()) {
                ++$player->activity()->gamesPlayed;
            }
            $this->uow->publish(new GameRoundPlayed($userId, $session->id(), $session->isFinished()));
            $round = $outcome['round'];

            return [
                'correct' => $outcome['correct'],
                'answer' => 'doors' === ($round['kind'] ?? null) ? null : $round['answer'],
                'reveal' => $round['reveal'] ?? null,
                'doors' => 'doors' === ($round['kind'] ?? null) ? $round['outcomes'] : null,
                'prize' => $prize,
                'bonus' => $bonus,
                'gained' => $outcome['gained'],
                'balance' => $player->wallet()->balance(),
                'session' => $session->view($def),
                'finished' => $session->isFinished(),
            ];
        });
    }

    /** Jeux du jour : parties restantes, partie en cours, meilleur score. */
    public function overview(string $userId): array
    {
        $now = $this->now();
        $since = $this->calendar->startOfDay($now);
        $games = [];
        foreach (GameType::cases() as $type) {
            $def = $type->def($this->settings);
            $active = $this->sessions->findActive($userId, $type);
            $games[] = ['type' => $type->value] + $def->publicArray() + [
                'playsLeft' => max(0, $def->playsPerDay - $this->sessions->countStartedSince($userId, $type, $since)),
                'active' => $active && !$active->isStale($now, self::ABANDON_AFTER_SECONDS) ? $active->id() : null,
                'bestScore' => $this->sessions->bestScore($userId, $type),
            ];
        }

        return ['resetsAt' => Iso::format($this->calendar->nextDay($now)), 'games' => $games];
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
