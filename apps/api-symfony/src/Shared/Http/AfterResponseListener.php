<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\TerminateEvent;

/** Exécute le travail confié par un contrôleur après l'envoi de la réponse (attribut de requête « _after_response »). */
#[AsEventListener]
final class AfterResponseListener
{
    public function __invoke(TerminateEvent $event): void
    {
        $work = $event->getRequest()->attributes->get('_after_response');
        if (\is_callable($work)) {
            $work();
        }
    }
}
