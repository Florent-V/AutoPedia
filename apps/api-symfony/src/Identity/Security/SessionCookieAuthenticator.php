<?php

declare(strict_types=1);

namespace App\Identity\Security;

use App\Identity\Service\SessionManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

/**
 * Authentifie chaque requête de l'API par le cookie de session (pare-feu sans état).
 * Sans session valide, access_control renvoie vers start() : 401 au format de l'API.
 */
final class SessionCookieAuthenticator extends AbstractAuthenticator implements AuthenticationEntryPointInterface
{
    public function __construct(private readonly SessionManager $sessions)
    {
    }

    public function supports(Request $request): ?bool
    {
        return $request->cookies->has(SessionManager::COOKIE) && !str_starts_with($request->getPathInfo(), '/api/auth/');
    }

    public function authenticate(Request $request): Passport
    {
        $session = $this->sessions->current($request);
        if (!$session) {
            throw new AuthenticationException('Session invalide ou expirée');
        }

        return new SelfValidatingPassport(new UserBadge($session->getUserId()));
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        return null;
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        // Session absente ou expirée : on continue en anonyme, access_control décidera (routes publiques ou 401).
        return null;
    }

    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        return new JsonResponse(['statusCode' => 401, 'message' => 'Authentification requise', 'error' => 'Unauthorized'], 401);
    }
}
