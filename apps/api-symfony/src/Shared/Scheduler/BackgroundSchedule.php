<?php

declare(strict_types=1);

namespace App\Shared\Scheduler;

use App\Bots\Job\BotsTick;
use App\Catalog\Job\SyncMedia;
use App\Marketplace\Job\ExpireTrades;
use App\Marketplace\Job\SettleDueAuctions;
use App\Notifications\Job\CheckFullReserves;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Lock\LockFactory;
use Symfony\Component\Scheduler\Attribute\AsSchedule;
use Symfony\Component\Scheduler\RecurringMessage;
use Symfony\Component\Scheduler\Schedule;
use Symfony\Component\Scheduler\ScheduleProviderInterface;

/**
 * Tâches de fond (équivalent des setInterval de NestJS), exécutées par le worker :
 *   php bin/console messenger:consume scheduler_default
 * Le verrou garantit qu'un seul worker exécute le programme, même avec plusieurs instances.
 */
#[AsSchedule]
final readonly class BackgroundSchedule implements ScheduleProviderInterface
{
    public function __construct(
        private LockFactory $locks,
        #[Autowire(env: 'BACKGROUND_JOBS')] private string $enabled,
        #[Autowire(env: 'int:AUCTION_SETTLE_SECONDS')] private int $auctionSettleSeconds,
        #[Autowire(env: 'int:TRADE_EXPIRE_SECONDS')] private int $tradeExpireSeconds,
        #[Autowire(env: 'int:PUSH_CHECK_SECONDS')] private int $pushCheckSeconds,
        #[Autowire(env: 'int:BOTS_TICK_SECONDS')] private int $botsTickSeconds,
        #[Autowire(env: 'int:MEDIA_SYNC_HOURS')] private int $mediaSyncHours,
        #[Autowire(env: 'CATALOG_AUTO_IMPORT')] private string $catalogAutoImport,
    ) {
    }

    public function getSchedule(): Schedule
    {
        $schedule = (new Schedule())->lock($this->locks->createLock('garage-background-schedule'));
        if ('off' === $this->enabled) {
            return $schedule;
        }

        $schedule->add(
            RecurringMessage::every(max(1, $this->auctionSettleSeconds).' seconds', new SettleDueAuctions()),
            RecurringMessage::every(max(1, $this->tradeExpireSeconds).' seconds', new ExpireTrades()),
            RecurringMessage::every(max(1, $this->pushCheckSeconds).' seconds', new CheckFullReserves()),
            RecurringMessage::every(max(1, $this->botsTickSeconds).' seconds', new BotsTick()),
        );
        if ($this->mediaSyncHours > 0 && 'off' !== $this->catalogAutoImport) {
            $schedule->add(RecurringMessage::every($this->mediaSyncHours.' hours', new SyncMedia()));
        }

        return $schedule;
    }
}
