import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CarsController } from './cars/cars.controller';
import { CarsService } from './cars/cars.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { MediaService } from './catalog/media.service';
import { HealthController } from './health.controller';
import { BotsModule } from './modules/bots/bots.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CollectionModule } from './modules/collection/collection.module';
import { GamesModule } from './modules/games/games.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlayerModule } from './modules/player/player.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    SharedModule,
    AuthModule,
    PlayerModule,
    WalletModule,
    CatalogModule,
    CollectionModule,
    StatisticsModule,
    ProgressionModule,
    GamesModule,
    MarketplaceModule,
    NotificationsModule,
    BotsModule,
  ],
  controllers: [HealthController, CarsController, CatalogController],
  providers: [CarsService, CatalogService, MediaService],
})
export class AppModule {}
