<?php

declare(strict_types=1);

namespace App\Marketplace\Job;

use App\Marketplace\Service\AuctionsService;
use App\Marketplace\Service\TradesService;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

/** Tâches de fond du marché : règlement des enchères échues, expiration des offres de la bourse. */
final class MarketJobs
{
    public function __construct(
        private readonly AuctionsService $auctions,
        private readonly TradesService $trades,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[AsMessageHandler]
    public function settle(SettleDueAuctions $job): void
    {
        $this->auctions->settleDue();
    }

    #[AsMessageHandler]
    public function expire(ExpireTrades $job): void
    {
        if ($n = $this->trades->expireDue()) {
            $this->logger->info("Offres expirées : $n");
        }
    }
}
