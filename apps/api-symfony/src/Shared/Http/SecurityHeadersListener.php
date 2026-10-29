<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ResponseEvent;

/** En-têtes de sécurité (équivalent de helmet) : l'API ne sert que du JSON et des images. */
#[AsEventListener]
final class SecurityHeadersListener
{
    public function __invoke(ResponseEvent $event): void
    {
        $headers = $event->getResponse()->headers;
        $headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Cross-Origin-Resource-Policy', 'same-site');
        $headers->set('Referrer-Policy', 'no-referrer');
        $headers->remove('X-Powered-By');
        header_remove('X-Powered-By');
    }
}
