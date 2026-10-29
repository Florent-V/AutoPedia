<?php

declare(strict_types=1);

namespace App\Catalog\Service;

use App\Catalog\Domain\Rarity;
use App\Catalog\Entity\Car;
use App\Catalog\Infrastructure\SeedCars;
use App\Catalog\Infrastructure\WikidataCar;
use App\Catalog\Infrastructure\WikidataSource;
use App\Catalog\Repository\CarRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\String\Slugger\AsciiSlugger;

/** Import du catalogue : Wikidata (avec repli sur le jeu de secours), puis calcul des raretés par notoriété. */
final class CatalogImporter
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CarRepository $cars,
        private readonly WikidataSource $wikidata,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** @return array{source: string, cards: int} */
    public function import(string $source, int $limit): array
    {
        if ('wikidata' === $source) {
            try {
                return $this->importWikidata($limit);
            } catch (\Throwable $e) {
                $this->logger->warning(\sprintf('Wikidata injoignable (%s) : utilisation du jeu de secours', $e->getMessage()));
                if ($this->cars->count([]) > 0) {
                    throw $e;
                }
            }
        }

        return $this->importSeed();
    }

    /** @return array{source: string, cards: int} */
    public function importWikidata(int $limit): array
    {
        $this->logger->info("Import Wikidata (max $limit modèles)…");
        $cars = $this->wikidata->fetchCars($limit, fn (int $done, int $total) => $this->logger->info("  détails $done/$total"));
        if (!$cars) {
            throw new \RuntimeException('Wikidata n’a renvoyé aucune voiture');
        }
        $count = $this->upsertWikidata($cars);
        $this->recomputeRarities();

        return ['source' => 'wikidata', 'cards' => $count];
    }

    /** @return array{source: string, cards: int} */
    public function importSeed(): array
    {
        $slugger = new AsciiSlugger();
        foreach (SeedCars::all() as [$name, $manufacturer, $country, $yearStart, $yearEnd, $popularity, $wikiTitle]) {
            $externalId = 'seed:'.strtolower((string) $slugger->slug($name));
            $car = $this->cars->findOneBy(['externalId' => $externalId]) ?? new Car($externalId, $name);
            $car->name = $name;
            $car->manufacturer = $manufacturer;
            $car->country = $country;
            $car->yearStart = $yearStart;
            $car->yearEnd = $yearEnd;
            $car->popularity = $popularity;
            $car->wikiTitle = $wikiTitle;
            $car->wikiLang = 'fr';
            $this->em->persist($car);
        }
        $this->em->flush();
        $this->recomputeRarities();

        return ['source' => 'seed', 'cards' => \count(SeedCars::all())];
    }

    /** Recalcule la rareté de toutes les cartes actives à partir de leur notoriété. */
    public function recomputeRarities(): void
    {
        $ids = array_map('intval', $this->em->getConnection()->fetchFirstColumn(
            'SELECT "id" FROM "car" WHERE "active" = true ORDER BY "popularity" DESC, "id" ASC',
        ));
        $byRarity = [];
        foreach (Rarity::assign($ids) as $id => $rarity) {
            $byRarity[$rarity->value][] = $id;
        }
        $this->em->wrapInTransaction(function () use ($byRarity) {
            foreach ($byRarity as $rarity => $list) {
                $this->em->getConnection()->executeStatement(
                    'UPDATE "car" SET "rarity" = CAST(:rarity AS "Rarity") WHERE "id" = ANY(CAST(:ids AS int[]))',
                    ['rarity' => $rarity, 'ids' => '{'.implode(',', $list).'}'],
                );
            }
        });
    }

    /** @param list<WikidataCar> $cars */
    private function upsertWikidata(array $cars): int
    {
        // Les cartes de secours qui correspondent à un article Wikipédia sont rattachées à Wikidata
        // (on conserve leur identifiant, donc les collections des joueurs).
        $seedByTitle = [];
        foreach ($this->cars->createQueryBuilder('c')->where('c.externalId LIKE :seed')->setParameter('seed', 'seed:%')->getQuery()->getResult() as $seed) {
            if ($seed->wikiTitle) {
                $seedByTitle[$seed->wikiTitle] = $seed;
            }
        }
        foreach (array_chunk($cars, 100) as $chunk) {
            foreach ($chunk as $c) {
                $car = $this->cars->findOneBy(['externalId' => $c->qid]);
                if (!$car && 'fr' === $c->wikiLang && $c->wikiTitle && isset($seedByTitle[$c->wikiTitle])) {
                    $car = $seedByTitle[$c->wikiTitle];
                    unset($seedByTitle[$c->wikiTitle]);
                    $car->attachToWikidata($c->qid);
                }
                $car ??= new Car($c->qid, $c->name);
                if (null !== $car->imageFile && $car->imageFile !== $c->imageFile) {
                    $car->resetLocalImage();
                }
                $car->name = $c->name;
                $car->manufacturer = $c->manufacturer;
                $car->country = $c->country;
                $car->yearStart = $c->yearStart;
                $car->yearEnd = $c->yearEnd;
                $car->imageUrl = $c->imageUrl;
                $car->imageFile = $c->imageFile;
                $car->racing = $c->racing;
                $car->wikiTitle = $c->wikiTitle;
                $car->wikiLang = $c->wikiLang;
                $car->powerKw = $c->powerKw;
                $car->topSpeedKmh = $c->topSpeedKmh;
                $car->massKg = $c->massKg;
                $car->lengthMm = $c->lengthMm;
                $car->popularity = $c->popularity;
                $car->active = true;
                $this->em->persist($car);
            }
            $this->em->flush();
            $this->em->clear();
        }

        return \count($cars);
    }
}
