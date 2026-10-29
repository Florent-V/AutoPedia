<?php

declare(strict_types=1);

namespace App\Notifications\Service;

use App\Notifications\Domain\PushEndpoint;
use App\Shared\Config\GameSettings;
use Doctrine\DBAL\Connection;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\HttpClient\Psr18Client;
use Symfony\Component\Uid\Uuid;

final class PushService
{
    public readonly bool $enabled;
    private readonly PushEndpoint $endpointPolicy;
    private ?WebPush $webPush = null;

    public function __construct(
        private readonly Connection $db,
        private readonly GameSettings $settings,
        private readonly LoggerInterface $logger,
        #[Autowire(env: 'VAPID_PUBLIC_KEY')] private readonly string $publicKey,
        #[Autowire(env: 'VAPID_PRIVATE_KEY')] private readonly string $privateKey,
        #[Autowire(env: 'VAPID_SUBJECT')] private readonly string $subject,
        #[Autowire(env: 'PUSH_ALLOWED_HOSTS')] string $allowedHosts,
    ) {
        $this->enabled = '' !== $publicKey && '' !== $privateKey;
        $this->endpointPolicy = new PushEndpoint($allowedHosts);
    }

    public function publicKey(): ?string
    {
        return $this->enabled ? $this->publicKey : null;
    }

    /** Enregistre (ou rattache à ce joueur) l'abonnement d'un navigateur. */
    public function subscribe(string $userId, string $endpoint, string $p256dh, string $auth, ?string $userAgent): void
    {
        $this->endpointPolicy->assertAllowed($endpoint);
        $ua = null === $userAgent ? null : mb_substr($userAgent, 0, 300);
        $this->db->executeStatement(
            'INSERT INTO "push_subscription" ("id", "userId", "endpoint", "p256dh", "auth", "userAgent") VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT ("endpoint") DO UPDATE SET "userId" = EXCLUDED."userId", "p256dh" = EXCLUDED."p256dh", "auth" = EXCLUDED."auth", "userAgent" = EXCLUDED."userAgent"',
            [Uuid::v4()->toRfc4122(), $userId, $endpoint, $p256dh, $auth, $ua],
        );
    }

    public function unsubscribe(string $userId, string $endpoint): void
    {
        $this->db->executeStatement('DELETE FROM "push_subscription" WHERE "userId" = ? AND "endpoint" = ?', [$userId, $endpoint]);
    }

    /**
     * Prévient les joueurs dont la réserve vient de se remplir (une seule fois par « remplissage »).
     * La mise à jour sert de verrou : un joueur n'est réclamé que par une seule exécution.
     */
    public function notifyFullReserves(): void
    {
        if (!$this->enabled) {
            return;
        }
        $max = $this->settings->boosterMax;
        $userIds = $this->db->fetchFirstColumn(
            'UPDATE "player" p SET "fullNotifiedAnchor" = p."boosterAnchor"
             WHERE p."boosters" < :max
               AND p."boosterAnchor" + make_interval(secs => (:max - p."boosters") * :regen::float8) <= now()
               AND (p."fullNotifiedAnchor" IS NULL OR p."fullNotifiedAnchor" <> p."boosterAnchor")
               AND EXISTS (SELECT 1 FROM "push_subscription" s WHERE s."userId" = p."userId")
             RETURNING p."userId"',
            ['max' => $max, 'regen' => $this->settings->boosterRegenMs / 1000],
        );
        foreach ($userIds as $userId) {
            $this->sendToUser($userId, [
                'title' => 'Ta réserve est pleine 🎁',
                'body' => "$max boosters t'attendent au garage. Ouvre-les pour relancer le compteur !",
                'url' => '/boosters',
                'tag' => 'boosters-full',
            ]);
        }
    }

    /** @param array{title: string, body: string, url?: string, tag?: string} $payload */
    public function sendToUser(string $userId, array $payload): void
    {
        if (!$this->enabled) {
            return;
        }
        $subs = $this->db->fetchAllAssociative('SELECT "id", "endpoint", "p256dh", "auth" FROM "push_subscription" WHERE "userId" = ?', [$userId]);
        foreach ($subs as $s) {
            $report = $this->client()->sendOneNotification(
                Subscription::create(['endpoint' => $s['endpoint'], 'keys' => ['p256dh' => $s['p256dh'], 'auth' => $s['auth']]]),
                json_encode($payload, \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_UNICODE),
                ['TTL' => 6 * 3600],
            );
            if ($report->isSubscriptionExpired()) {
                $this->db->executeStatement('DELETE FROM "push_subscription" WHERE "id" = ?', [$s['id']]);
            } elseif (!$report->isSuccess()) {
                $this->logger->warning(\sprintf('Échec d\'envoi push (%s)', $report->getResponse()?->getStatusCode() ?? 'réseau'));
            }
        }
    }

    private function client(): WebPush
    {
        return $this->webPush ??= new WebPush(
            ['VAPID' => ['subject' => $this->subject, 'publicKey' => $this->publicKey, 'privateKey' => $this->privateKey]],
            client: new Psr18Client(HttpClient::create(['timeout' => 10])),
        );
    }
}
