<?php

declare(strict_types=1);

namespace App\Identity\Controller;

use App\Identity\Entity\Session;
use App\Identity\Entity\User;
use App\Identity\Service\AuthError;
use App\Identity\Service\AuthService;
use App\Identity\Service\SessionManager;
use App\Shared\Domain\Iso;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Routes d'authentification, compatibles avec le client Better Auth du front (mêmes chemins, mêmes réponses) :
 * le front fonctionne à l'identique avec le backend NestJS ou Symfony.
 */
#[AsController]
#[Route('/auth')]
final class AuthController
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly SessionManager $sessions,
        private readonly EntityManagerInterface $em,
        #[Autowire(service: 'limiter.sign_in')] private readonly RateLimiterFactoryInterface $signInLimiter,
        #[Autowire(service: 'limiter.sign_up')] private readonly RateLimiterFactoryInterface $signUpLimiter,
        #[Autowire(env: 'AUTH_RATE_LIMIT')] private readonly string $rateLimit,
    ) {
    }

    #[Route('/sign-up/email', methods: ['POST'])]
    public function signUp(Request $request): JsonResponse
    {
        return $this->handle(function () use ($request) {
            $this->limit($this->signUpLimiter, $request);
            $body = $this->body($request);
            $user = $this->auth->signUp($this->str($body, 'name'), $this->str($body, 'email'), $this->str($body, 'password'));
            $response = new JsonResponse();
            $this->sessions->open($user, $request, $response);

            return $response->setData(['token' => null, 'user' => $this->userView($user)]);
        });
    }

    #[Route('/sign-in/email', methods: ['POST'])]
    public function signIn(Request $request): JsonResponse
    {
        return $this->handle(function () use ($request) {
            $this->limit($this->signInLimiter, $request);
            $body = $this->body($request);
            $user = $this->auth->verify($this->str($body, 'email'), $this->str($body, 'password'));
            $response = new JsonResponse();
            $this->sessions->open($user, $request, $response);

            return $response->setData(['redirect' => false, 'token' => null, 'user' => $this->userView($user)]);
        });
    }

    #[Route('/sign-out', methods: ['POST'])]
    public function signOut(Request $request): JsonResponse
    {
        $response = new JsonResponse(['success' => true]);
        $this->sessions->close($request, $response);

        return $response;
    }

    #[Route('/get-session', methods: ['GET'])]
    public function getSession(Request $request): JsonResponse
    {
        $session = $this->sessions->current($request);
        $user = $session ? $this->em->find(User::class, $session->getUserId()) : null;
        if (!$session || !$user) {
            return JsonResponse::fromJsonString('null');
        }

        return new JsonResponse(['session' => $this->sessionView($session), 'user' => $this->userView($user)]);
    }

    /** @param callable(): JsonResponse $action */
    private function handle(callable $action): JsonResponse
    {
        try {
            return $action();
        } catch (AuthError $e) {
            return new JsonResponse(['code' => $e->errorCode, 'message' => $e->getMessage()], $e->status);
        }
    }

    private function limit(RateLimiterFactoryInterface $limiter, Request $request): void
    {
        if ('off' !== $this->rateLimit && !$limiter->create($request->getClientIp() ?? 'inconnu')->consume()->isAccepted()) {
            throw new AuthError(429, 'TOO_MANY_REQUESTS', 'Trop de tentatives : réessayez dans une minute');
        }
    }

    /** @return array<string, mixed> */
    private function body(Request $request): array
    {
        try {
            $data = json_decode($request->getContent() ?: '{}', true, 8, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new AuthError(400, 'INVALID_BODY', 'Corps de requête JSON invalide');
        }

        return \is_array($data) ? $data : [];
    }

    /** @param array<string, mixed> $body */
    private function str(array $body, string $key): string
    {
        return \is_string($body[$key] ?? null) ? $body[$key] : throw new AuthError(400, 'VALIDATION_ERROR', "Champ « $key » manquant");
    }

    /** @return array<string, mixed> */
    private function userView(User $user): array
    {
        return [
            'id' => $user->getId(),
            'name' => $user->getName(),
            'email' => $user->getEmail(),
            'emailVerified' => $user->isEmailVerified(),
            'image' => $user->getImage(),
            'createdAt' => Iso::format($user->getCreatedAt()),
            'updatedAt' => Iso::format($user->getUpdatedAt()),
        ];
    }

    /** @return array<string, mixed> */
    private function sessionView(Session $session): array
    {
        return [
            'id' => $session->getId(),
            'userId' => $session->getUserId(),
            'expiresAt' => Iso::format($session->getExpiresAt()),
            'createdAt' => Iso::format($session->getCreatedAt()),
            'updatedAt' => Iso::format($session->getUpdatedAt()),
            'ipAddress' => $session->getIpAddress(),
            'userAgent' => $session->getUserAgent(),
        ];
    }
}
