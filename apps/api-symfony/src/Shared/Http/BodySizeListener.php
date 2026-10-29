<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Corps de requête limité à 100 ko. */
#[AsEventListener(priority: 90)]
final class BodySizeListener
{
    private const MAX_BYTES = 100 * 1024;

    public function __invoke(RequestEvent $event): void
    {
        $length = (int) $event->getRequest()->headers->get('Content-Length', '0');
        if ($length > self::MAX_BYTES || \strlen($event->getRequest()->getContent()) > self::MAX_BYTES) {
            throw new HttpException(413, 'Requête trop volumineuse');
        }
    }
}
