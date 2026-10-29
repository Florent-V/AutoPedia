<?php

declare(strict_types=1);

namespace App\Bots\Job;

use App\Bots\Service\BotsService;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final readonly class BotsTickHandler
{
    public function __construct(private BotsService $bots)
    {
    }

    public function __invoke(BotsTick $job): void
    {
        $this->bots->tick();
    }
}
