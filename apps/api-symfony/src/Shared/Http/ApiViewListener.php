<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ViewEvent;

/**
 * Les contrôleurs renvoient des tableaux : ils sont encodés en JSON ici
 * (après l'ajout éventuel de newAchievements par la progression, priorité plus haute).
 * Un attribut #[Status(201)] sur l'action change le code de réponse.
 */
#[AsEventListener]
final class ApiViewListener
{
    public function __invoke(ViewEvent $event): void
    {
        $result = $event->getControllerResult();
        $status = $event->getRequest()->attributes->get('_status', Response::HTTP_OK);
        if (null === $result && Response::HTTP_NO_CONTENT === $status) {
            $event->setResponse(new Response(null, Response::HTTP_NO_CONTENT));

            return;
        }
        $response = new JsonResponse($result, $status);
        $response->setEncodingOptions(JsonResponse::DEFAULT_ENCODING_OPTIONS | \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_PRESERVE_ZERO_FRACTION);
        $event->setResponse($response);
    }
}
