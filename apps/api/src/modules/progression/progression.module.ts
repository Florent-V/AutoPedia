import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CatalogModule } from '../catalog/catalog.module';
import { CollectionModule } from '../collection/collection.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { WalletModule } from '../wallet/wallet.module';
import { AchievementUnlocks } from './application/achievement-unlocks';
import { AchievementsService } from './application/achievements.service';
import { DailyRewardService } from './application/daily-reward.service';
import { ProgressionHandlers } from './application/progression.handlers';
import { DailyStreakRepository } from './domain/daily-streak';
import { AchievementsController } from './http/achievements.controller';
import { DailyController } from './http/daily.controller';
import { NewAchievementsInterceptor } from './http/new-achievements.interceptor';
import { PrismaDailyStreakRepository } from './infrastructure/prisma-daily-streak.repository';

/** Contexte « Progression » : statistiques, succès (et leurs récompenses), récompense quotidienne. */
@Module({
  imports: [WalletModule, CollectionModule, CatalogModule, StatisticsModule],
  controllers: [AchievementsController, DailyController],
  providers: [
    AchievementsService,
    AchievementUnlocks,
    DailyRewardService,
    ProgressionHandlers,
    { provide: DailyStreakRepository, useClass: PrismaDailyStreakRepository },
    { provide: APP_INTERCEPTOR, useClass: NewAchievementsInterceptor },
  ],
  exports: [AchievementsService, DailyRewardService],
})
export class ProgressionModule {}
