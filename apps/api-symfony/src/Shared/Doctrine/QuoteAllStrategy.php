<?php

declare(strict_types=1);

namespace App\Shared\Doctrine;

use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Mapping\DefaultQuoteStrategy;
use Doctrine\ORM\Mapping\JoinColumnMapping;

/**
 * Le schéma (partagé avec le backend NestJS / Prisma) utilise des noms en camelCase (« userId ») et
 * une table « user », mot réservé de PostgreSQL : tous les identifiants sont donc entourés de guillemets.
 * Associée à la stratégie de nommage par défaut (nom de colonne = nom de propriété), les entités
 * se lisent sans aucun « name: » à répéter.
 */
final class QuoteAllStrategy extends DefaultQuoteStrategy
{
    public function getColumnName(string $fieldName, ClassMetadata $class, AbstractPlatform $platform): string
    {
        return $platform->quoteSingleIdentifier($class->fieldMappings[$fieldName]->columnName);
    }

    public function getTableName(ClassMetadata $class, AbstractPlatform $platform): string
    {
        return $platform->quoteSingleIdentifier($class->table['name']);
    }

    public function getJoinColumnName(JoinColumnMapping $joinColumn, ClassMetadata $class, AbstractPlatform $platform): string
    {
        return $platform->quoteSingleIdentifier($joinColumn->name);
    }

    public function getReferencedJoinColumnName(JoinColumnMapping $joinColumn, ClassMetadata $class, AbstractPlatform $platform): string
    {
        return $platform->quoteSingleIdentifier($joinColumn->referencedColumnName);
    }

    public function getIdentifierColumnNames(ClassMetadata $class, AbstractPlatform $platform): array
    {
        return array_map(
            fn (string $field) => $this->getColumnName($field, $class, $platform),
            $class->identifier,
        );
    }
}
