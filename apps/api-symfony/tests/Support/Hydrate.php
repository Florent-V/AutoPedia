<?php

declare(strict_types=1);

namespace App\Tests\Support;

/** Restaure l'état privé d'un objet (entités et embarqués), comme le ferait Doctrine au chargement. */
final class Hydrate
{
    /**
     * @template T of object
     *
     * @param class-string<T>      $class
     * @param array<string, mixed> $state
     *
     * @return T
     */
    public static function make(string $class, array $state): object
    {
        $object = (new \ReflectionClass($class))->newInstanceWithoutConstructor();
        foreach ($state as $name => $value) {
            (new \ReflectionProperty($class, $name))->setValue($object, $value);
        }

        return $object;
    }
}
