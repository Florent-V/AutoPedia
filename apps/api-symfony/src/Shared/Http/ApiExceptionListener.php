<?php

declare(strict_types=1);

namespace App\Shared\Http;

use App\Shared\Domain\Exception\DomainException;
use Doctrine\DBAL\Exception\DeadlockException;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Toutes les erreurs de l'API au même format que NestJS : { statusCode, message, error }.
 * Erreur métier → son code ; unicité violée par deux requêtes simultanées → 409 ; inconnue → 500 sans détail.
 */
#[AsEventListener(priority: -10)]
final class ApiExceptionListener
{
    private const ERRORS = [
        400 => 'Bad Request', 401 => 'Unauthorized', 403 => 'Forbidden', 404 => 'Not Found', 405 => 'Method Not Allowed',
        409 => 'Conflict', 413 => 'Payload Too Large', 415 => 'Unsupported Media Type', 422 => 'Unprocessable Entity',
        429 => 'Too Many Requests', 503 => 'Service Unavailable',
    ];

    public function __construct(private readonly LoggerInterface $logger)
    {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        if (!str_starts_with($event->getRequest()->getPathInfo(), '/api')) {
            return;
        }
        $e = $event->getThrowable();
        [$status, $message] = match (true) {
            $e instanceof DomainException => [$e->httpStatus(), $e->getMessage()],
            $e instanceof HttpExceptionInterface => [$e->getStatusCode(), $e->getMessage() ?: (self::ERRORS[$e->getStatusCode()] ?? 'Erreur')],
            $e instanceof UniqueConstraintViolationException, $e instanceof DeadlockException => [409, 'Action déjà effectuée ou en conflit avec une autre : réessayez'],
            default => [500, 'Erreur interne'],
        };
        if (500 === $status) {
            $this->logger->error($e->getMessage(), ['exception' => $e]);
        }
        $response = new JsonResponse(['statusCode' => $status, 'message' => $message, 'error' => self::ERRORS[$status] ?? 'Internal Server Error'], $status);
        if ($e instanceof HttpExceptionInterface) {
            $response->headers->add($e->getHeaders());
        }
        $event->setResponse($response);
    }
}
