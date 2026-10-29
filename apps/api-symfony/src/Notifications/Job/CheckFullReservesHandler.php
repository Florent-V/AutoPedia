<?php

declare(strict_types=1);

namespace App\Notifications\Job;

use App\Notifications\Service\PushService;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final readonly class CheckFullReservesHandler
{
    public function __construct(private PushService $push)
    {
    }

    public function __invoke(CheckFullReserves $job): void
    {
        $this->push->notifyFullReserves();
    }
}
