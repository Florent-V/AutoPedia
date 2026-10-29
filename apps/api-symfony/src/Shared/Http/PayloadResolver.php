<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Controller\ValueResolverInterface;
use Symfony\Component\HttpKernel\ControllerMetadata\ArgumentMetadata;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Construit et valide les objets d'entrée marqués #[Payload] :
 *  1. refuse les champs inconnus (400) ;
 *  2. contrôle les types (entier, texte, objet imbriqué) : « 5abc » ou 1.5 pour un entier → 400 ;
 *  3. applique les contraintes #[Assert\…] du composant Validator (400 avec les messages).
 */
final class PayloadResolver implements ValueResolverInterface
{
    public function __construct(private readonly ValidatorInterface $validator)
    {
    }

    /** @return iterable<object> */
    public function resolve(Request $request, ArgumentMetadata $argument): iterable
    {
        $attribute = $argument->getAttributesOfType(Payload::class)[0] ?? null;
        if (!$attribute) {
            return [];
        }
        if ('query' === $attribute->from) {
            $data = $request->query->all();
        } else {
            $content = trim($request->getContent());
            try {
                $data = '' === $content ? [] : json_decode($content, true, 16, \JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new BadRequestHttpException('Corps de requête JSON invalide');
            }
            if (!\is_array($data) || ([] !== $data && array_is_list($data))) {
                throw new BadRequestHttpException('Un objet JSON est attendu');
            }
        }
        $object = $this->build($argument->getType() ?? throw new \LogicException('Type attendu'), $data, '', 'query' === $attribute->from);
        $violations = $this->validator->validate($object);
        if (\count($violations) > 0) {
            $messages = [];
            foreach ($violations as $v) {
                $messages[] = ($v->getPropertyPath() ? $v->getPropertyPath().' : ' : '').$v->getMessage();
            }
            throw new BadRequestHttpException(implode(', ', $messages));
        }

        return [$object];
    }

    /**
     * @param class-string         $class
     * @param array<string, mixed> $data
     */
    private function build(string $class, array $data, string $prefix, bool $fromQuery): object
    {
        $reflection = new \ReflectionClass($class);
        $properties = [];
        foreach ($reflection->getProperties(\ReflectionProperty::IS_PUBLIC) as $p) {
            $properties[$p->getName()] = $p;
        }
        foreach (array_keys($data) as $key) {
            if (!isset($properties[$key])) {
                throw new BadRequestHttpException(\sprintf('La propriété « %s%s » n\'est pas autorisée', $prefix, $key));
            }
        }
        $object = $reflection->newInstanceWithoutConstructor();
        foreach ($properties as $name => $property) {
            if (!\array_key_exists($name, $data)) {
                if ($property->hasDefaultValue()) {
                    $property->setValue($object, $property->getDefaultValue());
                } elseif ($property->getType()?->allowsNull()) {
                    $property->setValue($object, null);
                } else {
                    throw new BadRequestHttpException(\sprintf('« %s%s » est obligatoire', $prefix, $name));
                }
                continue;
            }
            $property->setValue($object, $this->convert($property, $data[$name], $prefix.$name, $fromQuery));
        }

        return $object;
    }

    private function convert(\ReflectionProperty $property, mixed $value, string $path, bool $fromQuery): mixed
    {
        $type = $property->getType();
        if (!$type instanceof \ReflectionNamedType || 'mixed' === $type->getName()) {
            if (\is_array($value)) {
                throw new BadRequestHttpException("« $path » : valeur invalide");
            }

            return $value;
        }
        if (null === $value) {
            return $type->allowsNull() ? null : throw new BadRequestHttpException("« $path » est obligatoire");
        }

        return match ($type->getName()) {
            'int' => match (true) {
                \is_int($value) => $value,
                \is_string($value) && 1 === preg_match('/^-?\d{1,15}$/', $value) => (int) $value,
                default => throw new BadRequestHttpException("« $path » doit être un nombre entier"),
            },
            'string' => \is_string($value) ? $value : throw new BadRequestHttpException("« $path » doit être un texte"),
            'bool' => \is_bool($value) ? $value : throw new BadRequestHttpException("« $path » doit être un booléen"),
            'float' => \is_int($value) || \is_float($value) ? (float) $value : throw new BadRequestHttpException("« $path » doit être un nombre"),
            default => \is_array($value) && !array_is_list($value)
                ? $this->build($type->getName(), $value, $path.'.', $fromQuery)
                : throw new BadRequestHttpException("« $path » doit être un objet"),
        };
    }
}
