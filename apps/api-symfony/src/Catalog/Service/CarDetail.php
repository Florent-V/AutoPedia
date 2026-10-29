<?php

declare(strict_types=1);

namespace App\Catalog\Service;

use App\Catalog\Entity\Car;
use App\Catalog\Infrastructure\WikimediaClient;
use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;
use App\Shared\Domain\Exception\NotFound;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

/** Fiche complète d'une carte ; le résumé Wikipédia est rafraîchi s'il date de plus de 30 jours. */
final class CarDetail
{
    public function __construct(
        private readonly CarRepository $cars,
        private readonly EntityManagerInterface $em,
        private readonly WikimediaClient $wiki,
        private readonly CardView $view,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** @return array<string, mixed> */
    public function detail(int $id): array
    {
        $car = $this->cars->find($id) ?? throw new NotFound('Carte introuvable');
        $this->refreshSummary($car);

        return $this->view->card($car) + ['summary' => $car->summary, 'imageCredit' => $this->view->imageCredit($car)];
    }

    private function refreshSummary(Car $car): void
    {
        $stale = null === $car->summaryFetchedAt || $car->summaryFetchedAt < new \DateTimeImmutable('-30 days');
        if (!$car->wikiTitle || !$stale) {
            return;
        }
        try {
            $car->summary = $this->wiki->summary($car->wikiLang ?? 'fr', $car->wikiTitle) ?? $car->summary;
            $car->summaryFetchedAt = new \DateTimeImmutable();
            $this->em->flush();
        } catch (\Throwable $e) {
            $this->logger->warning(\sprintf('Résumé Wikipédia indisponible pour %s : %s', $car->wikiTitle, $e->getMessage()));
        }
    }
}
