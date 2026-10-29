<?php

declare(strict_types=1);

namespace App\Shared\Domain;

/** Dates au format ISO 8601 en UTC avec millisecondes, comme Date.toISOString() côté NestJS. */
final class Iso
{
    public static function format(?\DateTimeInterface $at): ?string
    {
        if (null === $at) {
            return null;
        }

        return \DateTimeImmutable::createFromInterface($at)->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }
}
