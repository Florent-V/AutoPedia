<?php

declare(strict_types=1);

namespace App\Identity\Service;

use App\Identity\Entity\Session;
use App\Identity\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/** Sessions de connexion : création, lecture depuis le cookie, prolongation, révocation. */
final class SessionManager
{
    public const COOKIE = 'garage_session';
    private const LIFETIME = 30 * 24 * 3600;
    private const UPDATE_AGE = 24 * 3600;

    private readonly bool $secure;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ClockInterface $clock,
        #[Autowire(env: 'PUBLIC_URL')] string $publicUrl,
    ) {
        $this->secure = str_starts_with($publicUrl, 'https://');
    }

    /** Ouvre une session et pose le cookie sur la réponse. */
    public function open(User $user, Request $request, Response $response): Session
    {
        $now = $this->now();
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $session = new Session(
            bin2hex(random_bytes(16)),
            hash('sha256', $token),
            $user->getId(),
            $now->modify('+'.self::LIFETIME.' seconds'),
            $request->getClientIp(),
            $request->headers->get('User-Agent'),
            $now,
        );
        $this->em->persist($session);
        $this->em->flush();
        $response->headers->setCookie(Cookie::create(self::COOKIE, $token, $session->getExpiresAt(), '/', null, $this->secure, true, false, Cookie::SAMESITE_LAX));

        return $session;
    }

    /** Session valide correspondant au cookie de la requête (null si absente, inconnue ou expirée). */
    public function current(Request $request): ?Session
    {
        $token = $request->cookies->get(self::COOKIE);
        if (!\is_string($token) || '' === $token || \strlen($token) > 100) {
            return null;
        }
        $session = $this->em->getRepository(Session::class)->findOneBy(['token' => hash('sha256', $token)]);
        if (!$session) {
            return null;
        }
        $now = $this->now();
        if ($session->isExpired($now)) {
            $this->em->remove($session);
            $this->em->flush();

            return null;
        }
        if ($session->extendIfStale($now, self::LIFETIME, self::UPDATE_AGE)) {
            $this->em->flush();
        }

        return $session;
    }

    public function close(Request $request, Response $response): void
    {
        $session = $this->current($request);
        if ($session) {
            $this->em->remove($session);
            $this->em->flush();
        }
        $response->headers->clearCookie(self::COOKIE, '/', null, $this->secure, true, Cookie::SAMESITE_LAX);
    }

    private function now(): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromInterface($this->clock->now());
    }
}
