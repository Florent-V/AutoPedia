<?php

declare(strict_types=1);

namespace App\Notifications\Domain;

use App\Shared\Domain\Exception\InvalidRequest;

/**
 * Services de notification des navigateurs. Le serveur envoie des requêtes à l'adresse fournie par le client :
 * on la limite à ces services pour qu'elle ne puisse pas viser une machine interne (SSRF).
 */
final readonly class PushEndpoint
{
    /** @var list<string> */
    private array $hosts;

    public function __construct(string $allowedHosts)
    {
        $this->hosts = array_values(array_filter(array_map(fn (string $h) => strtolower(trim($h)), explode(',', $allowedHosts))));
    }

    public function assertAllowed(string $endpoint): void
    {
        $url = parse_url($endpoint);
        if (false === $url || !isset($url['scheme'], $url['host'])) {
            throw new InvalidRequest('Adresse de notification invalide');
        }
        $host = strtolower($url['host']);
        $allowed = false;
        foreach ($this->hosts as $h) {
            $allowed = $allowed || (str_starts_with($h, '.') ? str_ends_with($host, $h) : $host === $h);
        }
        if ('https' !== strtolower($url['scheme']) || isset($url['port']) || isset($url['user']) || !$allowed) {
            throw new InvalidRequest('Service de notification non pris en charge');
        }
    }
}
