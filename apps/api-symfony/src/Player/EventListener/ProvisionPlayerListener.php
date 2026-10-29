<?php

declare(strict_types=1);

namespace App\Player\EventListener;

use App\Player\Service\PlayerProvisioning;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;

/** Garantit que le joueur connecté a sa fiche avant d'atteindre un contrôleur (après le pare-feu). */
#[AsEventListener(priority: 6)]
final class ProvisionPlayerListener
{
    public function __construct(private readonly Security $security, private readonly PlayerProvisioning $provisioning)
    {
    }

    public function __invoke(RequestEvent $event): void
    {
        $user = $event->isMainRequest() ? $this->security->getUser() : null;
        if ($user) {
            $this->provisioning->ensure($user->getUserIdentifier());
        }
    }
}
