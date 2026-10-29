<?php

declare(strict_types=1);

namespace App\Games\Entity;

use App\Games\Domain\GameDef;
use App\Games\Domain\GameStatus;
use App\Games\Domain\GameType;
use App\Games\Domain\Round;
use App\Shared\Domain\Exception\InvalidRequest;
use App\Shared\Domain\Exception\RuleViolation;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Partie de mini-jeu (entité riche) : seul le serveur connaît la réponse, le client n'envoie que son choix.
 * L'état (manche en cours avec sa réponse, cartes déjà utilisées, historique) est stocké en JSON.
 */
#[ORM\Entity(repositoryClass: \App\Games\Repository\GameSessionRepository::class)]
#[ORM\Table(name: 'game_session')]
class GameSession
{
    #[ORM\Id]
    #[ORM\Column(type: 'text')]
    private string $id;

    #[ORM\Column(type: 'text')]
    private string $userId;

    #[ORM\Column(type: 'game_type')]
    private GameType $type;

    #[ORM\Column(type: 'game_status')]
    private GameStatus $status = GameStatus::ACTIVE;

    /** @var array{used: list<int>, current: array<string, mixed>|null, history: list<array{correct: bool}>} */
    #[ORM\Column(type: 'json', options: ['jsonb' => true])]
    private array $state;

    #[ORM\Column]
    private int $round = 1;

    #[ORM\Column]
    private int $score = 0;

    #[ORM\Column]
    private int $credits = 0;

    #[ORM\Column(nullable: true)]
    private ?int $rewardCarId = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    /** @param array<string, mixed> $first */
    public function __construct(string $userId, GameType $type, array $first, \DateTimeImmutable $now)
    {
        $this->id = Uuid::v4()->toRfc4122();
        $this->userId = $userId;
        $this->type = $type;
        $this->state = ['used' => Round::carsUsedBy($first), 'current' => $first, 'history' => []];
        $this->createdAt = $now;
    }

    public function id(): string
    {
        return $this->id;
    }

    public function type(): GameType
    {
        return $this->type;
    }

    public function isFinished(): bool
    {
        return GameStatus::FINISHED === $this->status;
    }

    /** @return list<int> */
    public function usedCars(): array
    {
        return $this->state['used'];
    }

    public function isStale(\DateTimeImmutable $now, int $maxAgeSeconds): bool
    {
        return $now->getTimestamp() - $this->createdAt->getTimestamp() >= $maxAgeSeconds;
    }

    /**
     * Juge la réponse à la manche en cours.
     *
     * @return array{correct: bool, prizeCarId: ?int, jackpot: bool, round: array<string, mixed>, gained: int, continues: bool}
     */
    public function answer(mixed $choice, GameDef $def): array
    {
        if ($this->isFinished()) {
            throw new RuleViolation('Cette partie est terminée');
        }
        $round = $this->state['current'] ?? throw new RuleViolation('Aucune question en cours');
        if (!$def->isValidChoice($choice)) {
            throw new InvalidRequest('Réponse invalide');
        }
        $judgement = Round::judge($round, $choice, 'card' === $def->reward);
        $gained = $judgement['correct'] ? $def->creditsPerWin : 0;
        $this->score += $judgement['correct'] ? 1 : 0;
        $this->credits += $gained;
        $state = $this->state;
        $state['history'][] = ['correct' => $judgement['correct']];
        $state['current'] = null;
        $this->state = $state;
        if ($judgement['prizeCarId']) {
            $this->rewardCarId = $judgement['prizeCarId'];
        }
        $continues = $this->round < $def->rounds && !($def->endsOnMistake && !$judgement['correct']);

        return $judgement + ['round' => $round, 'gained' => $gained, 'continues' => $continues];
    }

    /**
     * Passe à la manche suivante, ou termine la partie ($next absent : plus de question possible).
     *
     * @param array<string, mixed>|null $next
     */
    public function continueWith(?array $next, \DateTimeImmutable $now): void
    {
        if (null === $next) {
            $this->finish($now);

            return;
        }
        ++$this->round;
        $state = $this->state;
        $state['current'] = $next;
        $state['used'] = [...$state['used'], ...Round::carsUsedBy($next)];
        $this->state = $state;
    }

    public function finish(\DateTimeImmutable $now): void
    {
        $this->status = GameStatus::FINISHED;
        $this->finishedAt = $now;
        $state = $this->state;
        $state['current'] = null;
        $this->state = $state;
    }

    /** Sans-faute sur un jeu qui l'autorise : carte bonus. */
    public function earnedPerfectBonus(GameDef $def): bool
    {
        return $this->isFinished() && $def->perfectBonus && $this->score >= $def->rounds;
    }

    public function setBonusCard(int $carId): void
    {
        $this->rewardCarId = $carId;
    }

    /** @return array<string, mixed> vue envoyée au client : la question en cours sans réponse ni contenu des portes */
    public function view(GameDef $def): array
    {
        $current = GameStatus::ACTIVE === $this->status ? $this->state['current'] : null;

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'name' => $def->name,
            'reward' => $def->reward,
            'status' => $this->status->value,
            'round' => $this->round,
            'total' => $def->rounds,
            'score' => $this->score,
            'credits' => $this->credits,
            'creditsPerWin' => $def->creditsPerWin,
            'history' => $this->state['history'],
            'question' => $current ? Round::publicQuestion($current) : null,
        ];
    }
}
