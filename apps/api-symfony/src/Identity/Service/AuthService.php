<?php

declare(strict_types=1);

namespace App\Identity\Service;

use App\Identity\Entity\Account;
use App\Identity\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactoryInterface;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

/** Inscription et vérification des identifiants (email + mot de passe). */
final class AuthService
{
    private readonly PasswordHasherInterface $hasher;
    private ?string $dummyHash = null;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ClockInterface $clock,
        PasswordHasherFactoryInterface $hashers,
    ) {
        $this->hasher = $hashers->getPasswordHasher('auth');
    }

    /** @throws AuthError */
    public function signUp(string $name, string $email, string $password): User
    {
        $name = trim($name);
        $email = mb_strtolower(trim($email));
        if ('' === $name || mb_strlen($name) > 50) {
            throw new AuthError(400, 'INVALID_NAME', 'Pseudo invalide');
        }
        $this->validateCredentials($email, $password);
        if ($this->em->getRepository(User::class)->findOneBy(['email' => $email])) {
            throw new AuthError(422, 'USER_ALREADY_EXISTS', 'Un compte existe déjà avec cet email');
        }
        $now = \DateTimeImmutable::createFromInterface($this->clock->now());
        $user = new User(bin2hex(random_bytes(16)), $name, $email, $now);
        $this->em->persist($user);
        $this->em->persist(new Account(bin2hex(random_bytes(16)), $user->getId(), $this->hasher->hash($password), $now));
        $this->em->flush();

        return $user;
    }

    /** @throws AuthError */
    public function verify(string $email, string $password): User
    {
        $email = mb_strtolower(trim($email));
        $this->validateCredentials($email, $password);
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        $account = $user ? $this->em->getRepository(Account::class)->findOneBy(['userId' => $user->getId(), 'providerId' => Account::CREDENTIAL]) : null;
        if (!$account || null === $account->getPassword()) {
            // Même durée qu'une vraie vérification : on ne révèle pas quels emails existent.
            $this->hasher->verify($this->dummyHash ??= $this->hasher->hash(bin2hex(random_bytes(8))), $password);
            throw new AuthError(401, 'INVALID_EMAIL_OR_PASSWORD', 'Email ou mot de passe incorrect');
        }
        if (!$this->hasher->verify($account->getPassword(), $password)) {
            throw new AuthError(401, 'INVALID_EMAIL_OR_PASSWORD', 'Email ou mot de passe incorrect');
        }
        if ($this->hasher->needsRehash($account->getPassword())) {
            $account->changePasswordHash($this->hasher->hash($password));
            $this->em->flush();
        }

        return $user;
    }

    private function validateCredentials(string $email, string $password): void
    {
        if (false === filter_var($email, \FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 254) {
            throw new AuthError(400, 'INVALID_EMAIL', 'Adresse email invalide');
        }
        if (mb_strlen($password) < 8) {
            throw new AuthError(400, 'PASSWORD_TOO_SHORT', 'Le mot de passe doit contenir au moins 8 caractères');
        }
        if (mb_strlen($password) > 128) {
            throw new AuthError(400, 'PASSWORD_TOO_LONG', 'Le mot de passe est trop long');
        }
    }
}
