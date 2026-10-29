<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\RequestEvent;

/**
 * Protection CSRF en plus des cookies SameSite : une action (POST…) venant d'un navigateur
 * doit provenir du site lui-même. Les clients hors navigateur n'envoient pas d'en-tête Origin.
 * Priorité haute : avant l'authentification.
 */
#[AsEventListener(priority: 100)]
final class OriginCheckListener
{
    /** @var list<string> */
    private array $allowed;

    public function __construct(#[Autowire(env: 'WEB_ORIGIN')] string $webOrigin)
    {
        $this->allowed = array_values(array_filter(array_map('trim', explode(',', $webOrigin))));
    }

    public function __invoke(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest() || $request->isMethodSafe() || !str_starts_with($request->getPathInfo(), '/api')) {
            return;
        }
        $origin = $request->headers->get('Origin');
        if ((null !== $origin && !\in_array($origin, $this->allowed, true)) || 'cross-site' === $request->headers->get('Sec-Fetch-Site')) {
            $event->setResponse(new JsonResponse(['statusCode' => 403, 'message' => 'Origine de la requête refusée', 'error' => 'Forbidden'], 403));
        }
    }
}
