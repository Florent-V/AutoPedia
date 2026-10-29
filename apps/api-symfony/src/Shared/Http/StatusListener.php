<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ControllerArgumentsEvent;

#[AsEventListener]
final class StatusListener
{
    public function __invoke(ControllerArgumentsEvent $event): void
    {
        $status = $event->getAttributes(Status::class)[0] ?? null;
        if ($status) {
            $event->getRequest()->attributes->set('_status', $status->code);
        }
    }
}
