<?php

declare(strict_types=1);

namespace App\Progression\EventListener;

use App\Progression\Service\AchievementUnlocks;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ViewEvent;

/**
 * Ajoute « newAchievements » (succès débloqués pendant la requête) à la réponse des actions du joueur,
 * quel que soit le contexte qui a déclenché le déblocage. Priorité plus haute que l'encodage JSON.
 */
#[AsEventListener(priority: 10)]
final class NewAchievementsListener
{
    public function __construct(private readonly AchievementUnlocks $unlocks, private readonly Security $security)
    {
    }

    public function __invoke(ViewEvent $event): void
    {
        $result = $event->getControllerResult();
        $user = $this->security->getUser();
        if ('POST' !== $event->getRequest()->getMethod() || !$user || !\is_array($result) || array_is_list($result) || \array_key_exists('newAchievements', $result)) {
            return;
        }
        $result['newAchievements'] = $this->unlocks->forUser($user->getUserIdentifier());
        $event->setControllerResult($result);
    }
}
