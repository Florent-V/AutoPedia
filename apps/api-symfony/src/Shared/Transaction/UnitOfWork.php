<?php

declare(strict_types=1);

namespace App\Shared\Transaction;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\EventDispatcher\EventDispatcherInterface;

/**
 * Unité de travail : exécute un cas d'usage dans une transaction Doctrine (les appels imbriqués la rejoignent).
 * Les événements de domaine publiés pendant le travail sont livrés :
 *  - immédiatement aux écouteurs ordinaires (dans la transaction : une erreur annule tout) ;
 *  - après validation aux écouteurs de « after_commit.<classe> » (notifications…).
 */
final class UnitOfWork
{
    /** @var list<object>|null événements à livrer après validation de la transaction en cours */
    private ?array $pending = null;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ManagerRegistry $registry,
        private readonly EventDispatcherInterface $dispatcher,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @template T
     *
     * @param callable(): T $work
     *
     * @return T
     */
    public function run(callable $work): mixed
    {
        if (null !== $this->pending) {
            return $work();
        }
        $this->pending = [];
        try {
            $result = $this->em->wrapInTransaction(static fn () => $work());
            $events = $this->pending;
        } catch (\Throwable $e) {
            // Après une erreur, Doctrine ferme l'EntityManager : on le réinitialise pour la suite (tâches de fond).
            if (!$this->em->isOpen()) {
                $this->registry->resetManager();
            }
            throw $e;
        } finally {
            $this->pending = null;
        }
        foreach ($events as $event) {
            try {
                $this->dispatcher->dispatch($event, self::afterCommit($event::class));
            } catch (\Throwable $e) {
                $this->logger->error(\sprintf('Écouteur après validation en échec (%s) : %s', $event::class, $e->getMessage()));
            }
        }

        return $result;
    }

    /** Publie un événement de domaine (à appeler dans run()). */
    public function publish(object $event): void
    {
        $this->dispatcher->dispatch($event);
        if (null === $this->pending) {
            $this->dispatcher->dispatch($event, self::afterCommit($event::class));

            return;
        }
        $this->pending[] = $event;
    }

    /** Nom d'événement des écouteurs « après validation » : #[AsEventListener(event: 'after_commit.'.MonEvenement::class)]. */
    public static function afterCommit(string $eventClass): string
    {
        return 'after_commit.'.$eventClass;
    }
}
