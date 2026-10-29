<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/**
 * Limitation de débit par joueur connecté (par adresse IP sinon) : 20 requêtes par seconde, 300 par minute.
 * Priorité 7 : juste après le pare-feu (8), qui a identifié le joueur.
 */
#[AsEventListener(priority: 7)]
final class RateLimitListener
{
    public function __construct(
        private readonly Security $security,
        #[Autowire(service: 'limiter.api_burst')] private readonly RateLimiterFactoryInterface $burst,
        #[Autowire(service: 'limiter.api_minute')] private readonly RateLimiterFactoryInterface $minute,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest() || !str_starts_with($request->getPathInfo(), '/api') || str_starts_with($request->getPathInfo(), '/api/auth/')) {
            return;
        }
        $user = $this->security->getUser();
        $key = $user ? 'user:'.$user->getUserIdentifier() : 'ip:'.$request->getClientIp();
        foreach ([$this->burst, $this->minute] as $factory) {
            $limit = $factory->create($key)->consume();
            if (!$limit->isAccepted()) {
                throw new TooManyRequestsHttpException($limit->getRetryAfter()->getTimestamp() - time(), 'Trop de requêtes : réessayez dans un instant');
            }
        }
    }
}
