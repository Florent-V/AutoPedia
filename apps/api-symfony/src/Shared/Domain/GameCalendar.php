<?php

declare(strict_types=1);

namespace App\Shared\Domain;

/**
 * Journées et heures de jeu dans le fuseau du jeu (Europe/Paris par défaut).
 * PHP gère nativement les fuseaux et les changements d'heure : pas de calcul manuel comme en JavaScript.
 */
final readonly class GameCalendar
{
    private \DateTimeZone $zone;

    public function __construct(string $timezone)
    {
        $this->zone = new \DateTimeZone($timezone);
    }

    /** Jour AAAA-MM-JJ dans le fuseau du jeu. */
    public function day(\DateTimeImmutable $at): string
    {
        return $at->setTimezone($this->zone)->format('Y-m-d');
    }

    public function hour(\DateTimeImmutable $at): int
    {
        return (int) $at->setTimezone($this->zone)->format('G');
    }

    public function yesterday(\DateTimeImmutable $at): string
    {
        return $this->day($this->startOfDay($at)->modify('-1 second'));
    }

    /** Minuit du jour (dans le fuseau), en UTC. */
    public function startOfDay(\DateTimeImmutable $at): \DateTimeImmutable
    {
        return $at->setTimezone($this->zone)->setTime(0, 0)->setTimezone(new \DateTimeZone('UTC'));
    }

    /** Minuit suivant (journées de 23 h ou 25 h comprises). */
    public function nextDay(\DateTimeImmutable $at): \DateTimeImmutable
    {
        return $at->setTimezone($this->zone)->modify('tomorrow')->setTimezone(new \DateTimeZone('UTC'));
    }

    /** Début de l'heure suivante. */
    public function nextHour(\DateTimeImmutable $at): \DateTimeImmutable
    {
        $local = $at->setTimezone($this->zone);

        return $local->setTime((int) $local->format('G'), 0)->modify('+1 hour')->setTimezone(new \DateTimeZone('UTC'));
    }
}
