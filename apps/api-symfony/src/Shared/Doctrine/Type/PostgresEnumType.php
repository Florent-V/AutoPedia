<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Types\Type;

/**
 * Type PostgreSQL ENUM (créé par la migration) ↔ enum PHP « backed ».
 * Côté PHP on manipule Rarity::EPIC, jamais une chaîne libre.
 */
abstract class PostgresEnumType extends Type
{
    /** @return class-string<\BackedEnum> */
    abstract protected function enumClass(): string;

    /** Nom du type dans PostgreSQL (« Rarity »…). */
    abstract protected function sqlType(): string;

    public function getSQLDeclaration(array $column, AbstractPlatform $platform): string
    {
        return $platform->quoteSingleIdentifier($this->sqlType());
    }

    public function convertToPHPValue(mixed $value, AbstractPlatform $platform): ?\BackedEnum
    {
        return null === $value ? null : ($this->enumClass())::from($value);
    }

    public function convertToDatabaseValue(mixed $value, AbstractPlatform $platform): ?string
    {
        if (null === $value) {
            return null;
        }

        return $value instanceof \BackedEnum ? (string) $value->value : ($this->enumClass())::from($value)->value;
    }
}
