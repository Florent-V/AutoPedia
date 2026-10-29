<?php

namespace App;

use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

class Kernel extends BaseKernel
{
    use MicroKernelTrait;

    public function __construct(string $environment, bool $debug)
    {
        // Dates stockées en UTC (comme Prisma) : PHP doit raisonner en UTC, le fuseau du jeu est appliqué explicitement.
        date_default_timezone_set('UTC');
        parent::__construct($environment, $debug);
    }

    public function boot(): void
    {
        parent::boot();
        // Comme BETTER_AUTH_SECRET côté NestJS : refus de démarrer en production avec le secret de développement.
        $secret = (string) $this->getContainer()->getParameter('kernel.secret');
        if ('prod' === $this->environment && ('' === $secret || 'change-me-dev-only-secret' === $secret)) {
            throw new \RuntimeException('APP_SECRET doit être défini en production');
        }
    }
}
