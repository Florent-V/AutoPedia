<?php

declare(strict_types=1);

namespace App\Catalog\Job;

use App\Catalog\Service\MediaSync;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final readonly class SyncMediaHandler
{
    public function __construct(private MediaSync $media)
    {
    }

    public function __invoke(SyncMedia $job): void
    {
        $this->media->syncAll();
    }
}
