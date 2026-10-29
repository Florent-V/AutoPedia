<?php

declare(strict_types=1);

namespace App\Notifications\Controller;

use App\Notifications\Dto\SubscribeInput;
use App\Notifications\Dto\UnsubscribeInput;
use App\Notifications\Service\PushService;
use App\Shared\Http\Payload;
use App\Shared\Http\Status;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[AsController]
#[Route('/push')]
final class PushController
{
    public function __construct(private readonly PushService $push)
    {
    }

    /** Public (voir access_control) : la clé VAPID publique sert à l'abonnement du navigateur. */
    #[Route('/public-key', methods: ['GET'])]
    public function publicKey(): array
    {
        return ['publicKey' => $this->push->publicKey()];
    }

    #[Route('/subscribe', methods: ['POST'])]
    #[Status(204)]
    public function subscribe(#[CurrentUser] UserInterface $user, #[Payload] SubscribeInput $input, Request $request): void
    {
        $this->assertEnabled();
        $this->push->subscribe($user->getUserIdentifier(), $input->endpoint, $input->keys->p256dh, $input->keys->auth, $request->headers->get('User-Agent'));
    }

    #[Route('/unsubscribe', methods: ['POST'])]
    #[Status(204)]
    public function unsubscribe(#[CurrentUser] UserInterface $user, #[Payload] UnsubscribeInput $input): void
    {
        $this->push->unsubscribe($user->getUserIdentifier(), $input->endpoint);
    }

    #[Route('/test', methods: ['POST'])]
    #[Status(204)]
    public function test(#[CurrentUser] UserInterface $user): void
    {
        $this->assertEnabled();
        $this->push->sendToUser($user->getUserIdentifier(), ['title' => 'Garage', 'body' => 'Les notifications fonctionnent 👌', 'url' => '/boosters', 'tag' => 'test']);
    }

    private function assertEnabled(): void
    {
        if (!$this->push->enabled) {
            throw new ServiceUnavailableHttpException(null, 'Notifications non configurées sur ce serveur');
        }
    }
}
