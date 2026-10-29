<?php

declare(strict_types=1);

namespace App\Shared\Doctrine\Type;

use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Types\Type;

/** Colonne PostgreSQL INTEGER[] ↔ list<int>. */
final class IntArrayType extends Type
{
    public const NAME = 'int_array';

    public function getSQLDeclaration(array $column, AbstractPlatform $platform): string
    {
        return 'INTEGER[]';
    }

    /** @return list<int>|null */
    public function convertToPHPValue(mixed $value, AbstractPlatform $platform): ?array
    {
        if (null === $value) {
            return null;
        }
        $inner = trim((string) $value, '{}');

        return '' === $inner ? [] : array_map('intval', explode(',', $inner));
    }

    public function convertToDatabaseValue(mixed $value, AbstractPlatform $platform): ?string
    {
        return null === $value ? null : '{'.implode(',', array_map('intval', $value)).'}';
    }
}
