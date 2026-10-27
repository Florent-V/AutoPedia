import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { jobsConfig } from '../../../config';
import { AuctionsService } from './auctions.service';
import { TradesService } from './trades.service';

/** Tâches de fond du marché : règlement des enchères échues, expiration des offres de la bourse. */
@Injectable()
export class MarketJobs implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketJobs.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly auctions: AuctionsService,
    private readonly trades: TradesService,
  ) {}

  onModuleInit() {
    if (!jobsConfig.enabled) return;
    this.every(jobsConfig.auctionSettleMs, () => this.auctions.settleDue());
    this.every(jobsConfig.tradeExpireMs, async () => {
      const n = await this.trades.expireDue();
      if (n) this.logger.log(`Offres expirées : ${n}`);
    });
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  private every(ms: number, job: () => Promise<unknown>) {
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      job()
        .catch((e: Error) => this.logger.error(e.message))
        .finally(() => (running = false));
    };
    setTimeout(run, Math.min(3000, ms)).unref();
    const timer = setInterval(run, ms);
    timer.unref();
    this.timers.push(timer);
  }
}
