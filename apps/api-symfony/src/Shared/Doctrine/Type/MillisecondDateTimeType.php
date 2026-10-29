<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Types\ConversionException;
use Doctrine\DBAL\Types\DateTimeImmutableType;

/**
 * Remplace « datetime_immutable » : le schéma (Prisma) stocke des timestamp(3) ;
 * le type d'origine de Doctrine tronque à la seconde, celui-ci garde les millisecondes.
 */
final class MillisecondDateTimeType extends DateTimeImmutableType
{
    public function convertToDatabaseValue(mixed $value, AbstractPlatform $platform): ?string
    {
        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i:s.v') : parent::convertToDatabaseValue($value, $platform);
    }

    public function convertToPHPValue(mixed $value, AbstractPlatform $platform): ?\DateTimeImmutable
    {
        if (null === $value || $value instanceof \DateTimeImmutable) {
            return $value;
        }
        try {
            return new \DateTimeImmutable((string) $value);
        } catch (\Exception $e) {
            throw ConversionException::conversionFailed((string) $value, 'datetime_immutable', $e);
        }
    }
}
