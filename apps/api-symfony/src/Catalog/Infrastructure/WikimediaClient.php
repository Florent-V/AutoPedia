<?php

declare(strict_types=1);

namespace App\Catalog\Infrastructure;

use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Client HTTP « poli » pour les services Wikimedia :
 *  - User-Agent identifiable avec un contact (exigé par la politique robots de Wikimedia) ;
 *  - espacement minimal entre deux requêtes vers un même domaine ;
 *  - nouvelles tentatives sur 429 / 502 / 503 / 504 en respectant l'en-tête Retry-After.
 */
final class WikimediaClient
{
    private const MIN_INTERVAL_MS = ['query.wikidata.org' => 1000, 'commons.wikimedia.org' => 1000, 'upload.wikimedia.org' => 250, 'thumb.wikimedia.org' => 250];

    private readonly string $userAgent;
    /** @var array<string, float> prochain créneau par domaine (ms) */
    private array $nextSlot = [];

    public function __construct(
        private readonly HttpClientInterface $http,
        private readonly LoggerInterface $logger,
        #[Autowire(env: 'WIKI_CONTACT')] string $contact,
        #[Autowire(env: 'WIKI_USER_AGENT')] string $userAgent,
        #[Autowire(env: 'WIKIMEDIA_TOKEN')] private readonly string $token,
    ) {
        $this->userAgent = '' !== $userAgent ? $userAgent : "GarageCardGame/0.2 ($contact)";
    }

    /**
     * @param array<string, mixed> $options options de HttpClient
     */
    public function request(string $method, string $url, array $options = [], float $timeout = 20, int $retries = 5, int $maxRetryAfterMs = 120_000): ResponseInterface
    {
        $host = (string) parse_url($url, \PHP_URL_HOST);
        $headers = ['User-Agent' => $this->userAgent, 'Api-User-Agent' => $this->userAgent] + ($options['headers'] ?? []);
        if ('' !== $this->token && preg_match('/(^|\.)(wikipedia|wikimedia|wikidata)\.org$/', $host)) {
            $headers['Authorization'] = 'Bearer '.$this->token;
        }
        $options = ['headers' => $headers, 'timeout' => $timeout, 'max_duration' => $timeout] + $options;

        for ($attempt = 0; ; ++$attempt) {
            $this->waitTurn($host);
            try {
                $response = $this->http->request($method, $url, $options);
                $status = $response->getStatusCode();
            } catch (\Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface $e) {
                if ($attempt >= $retries) {
                    throw $e;
                }
                usleep(2_000_000 * ($attempt + 1));
                continue;
            }
            if (\in_array($status, [429, 502, 503, 504], true) && $attempt < $retries) {
                $header = (int) ($response->getHeaders(false)['retry-after'][0] ?? 0);
                $wait = $header > 0 ? $header * 1000 : 5000 * 2 ** $attempt;
                if ($wait > $maxRetryAfterMs) {
                    throw new HttpError($status, $url);
                }
                $this->logger->warning(\sprintf('%s : HTTP %d, nouvelle tentative dans %d s', $host, $status, $wait / 1000));
                $this->nextSlot[$host] = microtime(true) * 1000 + $wait;
                usleep($wait * 1000);
                continue;
            }
            if ($status >= 400) {
                throw new HttpError($status, $url);
            }

            return $response;
        }
    }

    /**
     * Appelle l'API MediaWiki (action=query…) d'un wiki donné.
     *
     * @param array<string, string> $params
     *
     * @return array<string, mixed>
     */
    public function mediaWikiQuery(string $host, array $params): array
    {
        $query = http_build_query(['format' => 'json', 'formatversion' => '2', 'maxlag' => '5'] + $params);

        return $this->request('GET', "https://$host/w/api.php?$query", ['headers' => ['Accept' => 'application/json']])->toArray();
    }

    /** Résumé d'un article (à la volée, quand une fiche n'en a pas encore). */
    public function summary(string $lang, string $title): ?string
    {
        $url = \sprintf('https://%s.wikipedia.org/api/rest_v1/page/summary/%s', $lang, rawurlencode(str_replace(' ', '_', $title)));
        $data = $this->request('GET', $url, ['headers' => ['Accept' => 'application/json']], 8, 1, 3000)->toArray();

        return \is_string($data['extract'] ?? null) ? $data['extract'] : null;
    }

    private function waitTurn(string $host): void
    {
        $interval = self::MIN_INTERVAL_MS[$host] ?? (str_ends_with($host, 'wikipedia.org') ? 1000 : 500);
        $now = microtime(true) * 1000;
        $slot = max($now, $this->nextSlot[$host] ?? 0);
        $this->nextSlot[$host] = $slot + $interval;
        if ($slot > $now) {
            usleep((int) (($slot - $now) * 1000));
        }
    }
}
