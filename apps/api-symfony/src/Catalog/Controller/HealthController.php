<?php

declare(strict_types=1);

namespace App\Catalog\Controller;

use App\Catalog\Service\MediaSync;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
final class HealthController
{
    public function __construct(private readonly MediaSync $media)
    {
    }

    /** Public : état du service et du catalogue. */
    #[Route('/health', methods: ['GET'])]
    public function health(): array
    {
        $stats = $this->media->stats();

        return ['status' => 'ok', 'cards' => $stats['cards'], 'images' => $stats['withLocalImage'], 'backend' => 'symfony'];
    }
}
