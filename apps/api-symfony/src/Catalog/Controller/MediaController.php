<?php

declare(strict_types=1);

namespace App\Catalog\Controller;

use App\Catalog\Service\MediaSync;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Photos des cartes stockées localement. Le nom de fichier est strictement contrôlé :
 * impossible de sortir du dossier (« ../ ») ou de lire un fichier caché.
 */
#[AsController]
final class MediaController
{
    public function __construct(private readonly MediaSync $media)
    {
    }

    #[Route('/media/cars/{file}', requirements: ['file' => '.+'], methods: ['GET'])]
    public function car(string $file): BinaryFileResponse
    {
        if (1 !== preg_match('/^[A-Za-z0-9_:-]+-[0-9a-f]{8}\.webp$/', $file)) {
            throw new NotFoundHttpException('Photo introuvable');
        }
        $path = $this->media->mediaDir().'/cars/'.$file;
        if (!is_file($path)) {
            throw new NotFoundHttpException('Photo introuvable');
        }
        $response = new BinaryFileResponse($path, 200, ['Content-Type' => 'image/webp']);
        // Noms de fichiers versionnés (empreinte du fichier source) : cache long et immuable.
        $response->setPublic()->setMaxAge(365 * 24 * 3600)->setImmutable();

        return $response;
    }
}
