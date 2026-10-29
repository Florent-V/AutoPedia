<?php

declare(strict_types=1);

namespace App\Catalog\Service;

use App\Catalog\Entity\Car;
use App\Catalog\Infrastructure\HttpError;
use App\Catalog\Infrastructure\WikimediaClient;
use App\Catalog\Repository\CarRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

/**
 * Rapatriement des photos (Wikimedia Commons, converties en WebP 640 px avec GD) et des résumés Wikipédia.
 * Une erreur passagère (débit limité, réseau) arrête la synchronisation : elle reprendra plus tard.
 */
final class MediaSync
{
    private const IMAGE_WIDTH = 640;
    private const SOURCE_WIDTH = 960;
    private const RETRY_FAILED_AFTER = '-7 days';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CarRepository $cars,
        private readonly WikimediaClient $client,
        private readonly LoggerInterface $logger,
        #[Autowire(env: 'MEDIA_DIR')] private readonly string $mediaDir,
    ) {
    }

    public function mediaDir(): string
    {
        return $this->mediaDir;
    }

    public function syncAll(): void
    {
        try {
            // Commons d'abord (indépendant de Wikipédia), puis les cartes de secours qui passent par Wikipédia.
            $this->syncImages();
            $this->resolveSeedImageFiles();
            $this->syncImages();
            $this->syncSummaries();
        } catch (\Throwable $e) {
            $this->logger->warning(\sprintf('Synchronisation des médias interrompue (%s) : reprise automatique plus tard', $e->getMessage()));
        }
    }

    /** @return array{cards: int, withLocalImage: int, pendingImages: int, withoutImage: int, withSummary: int} */
    public function stats(): array
    {
        $count = fn (string $where) => (int) $this->em->getConnection()->fetchOne("SELECT COUNT(*) FROM \"car\" WHERE \"active\" = true $where");

        return [
            'cards' => $count(''),
            'withLocalImage' => $count('AND "imagePath" IS NOT NULL'),
            'pendingImages' => $count('AND "imagePath" IS NULL AND "imageFile" IS NOT NULL'),
            'withoutImage' => $count('AND "imagePath" IS NULL AND "imageFile" IS NULL'),
            'withSummary' => $count('AND "summary" IS NOT NULL'),
        ];
    }

    /** Les cartes du jeu de secours n'ont pas de fichier Commons : on prend l'image principale de leur article Wikipédia. */
    public function resolveSeedImageFiles(): void
    {
        $cars = $this->cars->createQueryBuilder('c')
            ->where('c.imageFile IS NULL AND c.wikiTitle IS NOT NULL AND c.imageCheckedAt IS NULL')->getQuery()->getResult();
        foreach ($this->byLang($cars) as $lang => $list) {
            foreach (array_chunk($list, 50) as $batch) {
                $titles = array_map(static fn (Car $c) => $c->wikiTitle, $batch);
                $res = $this->client->mediaWikiQuery("$lang.wikipedia.org", ['action' => 'query', 'prop' => 'pageimages', 'piprop' => 'name', 'redirects' => '1', 'titles' => implode('|', $titles)]);
                $resolved = self::resolveTitles($titles, $res['query'] ?? []);
                $images = [];
                foreach ($res['query']['pages'] ?? [] as $page) {
                    $images[$page['title']] = $page['pageimage'] ?? null;
                }
                foreach ($batch as $car) {
                    $file = $images[$resolved[$car->wikiTitle] ?? $car->wikiTitle] ?? null;
                    if ($file) {
                        $car->imageFile = str_replace('_', ' ', $file);
                    } else {
                        $car->imageCheckedAt = new \DateTimeImmutable();
                    }
                }
                $this->em->flush();
            }
        }
    }

    /** Télécharge, redimensionne et stocke localement les photos manquantes, avec leurs crédits. */
    public function syncImages(): void
    {
        if (!is_dir($this->mediaDir.'/cars')) {
            mkdir($this->mediaDir.'/cars', 0o775, true);
        }
        $pending = fn () => $this->cars->createQueryBuilder('c')
            ->where('c.active = true AND c.imagePath IS NULL AND c.imageFile IS NOT NULL AND (c.imageCheckedAt IS NULL OR c.imageCheckedAt < :retry)')
            ->setParameter('retry', new \DateTimeImmutable(self::RETRY_FAILED_AFTER))
            ->orderBy('c.popularity', 'DESC')->setMaxResults(50)->getQuery()->getResult();
        while ($batch = $pending()) {
            $infos = $this->fetchImageInfos(array_map(static fn (Car $c) => $c->imageFile, $batch));
            foreach ($batch as $car) {
                $this->storeImage($car, $infos[$car->imageFile] ?? null);
            }
            $this->em->flush();
        }
    }

    /** Récupère les résumés Wikipédia manquants, par lots de 20 articles. */
    public function syncSummaries(): void
    {
        $cars = $this->cars->createQueryBuilder('c')
            ->where('c.active = true AND c.summary IS NULL AND c.summaryFetchedAt IS NULL AND c.wikiTitle IS NOT NULL')
            ->orderBy('c.popularity', 'DESC')->getQuery()->getResult();
        foreach ($this->byLang($cars) as $lang => $list) {
            foreach (array_chunk($list, 20) as $batch) {
                $titles = array_map(static fn (Car $c) => $c->wikiTitle, $batch);
                $res = $this->client->mediaWikiQuery("$lang.wikipedia.org", [
                    'action' => 'query', 'prop' => 'extracts', 'exintro' => '1', 'explaintext' => '1', 'exsentences' => '5', 'exlimit' => '20', 'redirects' => '1', 'titles' => implode('|', $titles),
                ]);
                $resolved = self::resolveTitles($titles, $res['query'] ?? []);
                $extracts = [];
                foreach ($res['query']['pages'] ?? [] as $page) {
                    $extracts[$page['title']] = $page['extract'] ?? null;
                }
                foreach ($batch as $car) {
                    $car->summary = trim((string) ($extracts[$resolved[$car->wikiTitle] ?? $car->wikiTitle] ?? '')) ?: null;
                    $car->summaryFetchedAt = new \DateTimeImmutable();
                }
                $this->em->flush();
            }
        }
    }

    /** Texte brut à partir du HTML des métadonnées Commons (auteur). */
    public static function stripHtml(string $html): string
    {
        $text = html_entity_decode(strip_tags(preg_replace('/<[^>]*>/', ' ', $html) ?? ''), \ENT_QUOTES | \ENT_HTML5);

        return mb_substr(trim(preg_replace('/\s+/u', ' ', $text) ?? ''), 0, 200);
    }

    /**
     * @param list<string>         $files
     *
     * @return array<string, array<string, mixed>|null>
     */
    private function fetchImageInfos(array $files): array
    {
        $titles = array_map(static fn ($f) => "File:$f", $files);
        $res = $this->client->mediaWikiQuery('commons.wikimedia.org', [
            'action' => 'query', 'prop' => 'imageinfo', 'iiprop' => 'url|mime|extmetadata', 'iiurlwidth' => (string) self::SOURCE_WIDTH,
            'iiextmetadatafilter' => 'Artist|LicenseShortName|LicenseUrl|AttributionRequired', 'redirects' => '1', 'titles' => implode('|', $titles),
        ]);
        $resolved = self::resolveTitles($titles, $res['query'] ?? []);
        $pages = [];
        foreach ($res['query']['pages'] ?? [] as $page) {
            $pages[$page['title']] = $page;
        }
        $out = [];
        foreach ($files as $i => $file) {
            $out[$file] = $pages[$resolved[$titles[$i]] ?? $titles[$i]] ?? null;
        }

        return $out;
    }

    /** @param array<string, mixed>|null $page */
    private function storeImage(Car $car, ?array $page): void
    {
        $info = $page['imageinfo'][0] ?? null;
        $source = $info['thumburl'] ?? $info['url'] ?? null;
        if (!$info || !$source || !empty($page['missing'])) {
            $car->imageCheckedAt = new \DateTimeImmutable();

            return;
        }
        try {
            $input = $this->client->request('GET', $source, [], 30)->getContent();
            $image = @imagecreatefromstring($input);
            if (false === $image) {
                throw new \RuntimeException('format d’image non pris en charge');
            }
            $resized = imagescale($image, min(self::IMAGE_WIDTH, imagesx($image)));
            $rel = \sprintf('cars/%s-%s.webp', preg_replace('/[^a-zA-Z0-9-]/', '_', $car->getExternalId()), substr(sha1((string) $car->imageFile), 0, 8));
            imagewebp($resized, $this->mediaDir.'/'.$rel, 78);
            $meta = $info['extmetadata'] ?? [];
            $car->imagePath = $rel;
            $car->imageAuthor = isset($meta['Artist']['value']) ? (self::stripHtml($meta['Artist']['value']) ?: null) : null;
            $car->imageLicense = $meta['LicenseShortName']['value'] ?? null;
            $car->imageLicenseUrl = $meta['LicenseUrl']['value'] ?? null;
            $car->imageCheckedAt = new \DateTimeImmutable();
        } catch (HttpError $e) {
            if ($e->isTransient()) {
                throw $e;
            }
            $this->unusable($car, $e);
        } catch (TransportExceptionInterface $e) {
            throw $e;
        } catch (\Throwable $e) {
            $this->unusable($car, $e);
        }
    }

    private function unusable(Car $car, \Throwable $e): void
    {
        $this->logger->warning(\sprintf('Photo inutilisable pour « %s » : %s', $car->name, $e->getMessage()));
        $car->imageCheckedAt = new \DateTimeImmutable();
    }

    /**
     * @param list<Car> $cars
     *
     * @return array<string, list<Car>>
     */
    private function byLang(array $cars): array
    {
        $out = [];
        foreach ($cars as $car) {
            $out[$car->wikiLang ?? 'fr'][] = $car;
        }

        return $out;
    }

    /**
     * Suit les normalisations et redirections renvoyées par l'API MediaWiki.
     *
     * @param list<string>          $input
     * @param array<string, mixed>  $query
     *
     * @return array<string, string>
     */
    private static function resolveTitles(array $input, array $query): array
    {
        $norm = array_column($query['normalized'] ?? [], 'to', 'from');
        $redir = array_column($query['redirects'] ?? [], 'to', 'from');
        $out = [];
        foreach ($input as $t) {
            $n = $norm[$t] ?? $t;
            $out[$t] = $redir[$n] ?? $n;
        }

        return $out;
    }
}
