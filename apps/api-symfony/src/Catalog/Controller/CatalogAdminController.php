<?php

declare(strict_types=1);

namespace App\Catalog\Controller;

use App\Catalog\Dto\ImportInput;
use App\Catalog\Service\CatalogImporter;
use App\Catalog\Service\MediaSync;
use App\Shared\Http\Payload;
use App\Shared\Http\Status;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Administration du catalogue, protégée par l'en-tête « x-admin-token » comparé en temps constant
 * (désactivée si ADMIN_TOKEN fait moins de 16 caractères).
 */
#[AsController]
#[Route('/admin/catalog')]
final class CatalogAdminController
{
    public function __construct(
        private readonly CatalogImporter $importer,
        private readonly MediaSync $media,
        #[Autowire(env: 'ADMIN_TOKEN')] private readonly string $adminToken,
    ) {
    }

    #[Route('/status', methods: ['GET'])]
    public function status(Request $request): array
    {
        $this->checkToken($request);

        return $this->media->stats();
    }

    /** Relance l'import après l'envoi de la réponse (kernel.terminate), comme un traitement en arrière-plan. */
    #[Route('/import', methods: ['POST'])]
    #[Status(202)]
    public function import(Request $request, #[Payload] ImportInput $input): array
    {
        $this->checkToken($request);
        $request->attributes->set('_after_response', function () use ($input) {
            if ('media' === $input->source) {
                $this->media->syncAll();
            } else {
                $this->importer->import('seed' === $input->source ? 'seed' : 'wikidata', $input->limit ?? 3000);
            }
        });

        return ['started' => true];
    }

    private function checkToken(Request $request): void
    {
        $token = (string) $request->headers->get('x-admin-token', '');
        if (\strlen($this->adminToken) < 16 || !hash_equals($this->adminToken, $token)) {
            throw new AccessDeniedHttpException();
        }
    }
}
