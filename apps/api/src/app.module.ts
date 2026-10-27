import { Module } from '@nestjs/common';
import { AuctionsController } from './auctions/auctions.controller';
import { AuctionsService } from './auctions/auctions.service';
import { AuthModule } from './auth/auth.module';
import { BotsService } from './bots/bots.service';
import { CarsController } from './cars/cars.controller';
import { CarsService } from './cars/cars.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { MediaService } from './catalog/media.service';
import { GamesController } from './games/games.controller';
import { GamesService } from './games/games.service';
import { HealthController } from './health.controller';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CollectionModule } from './modules/collection/collection.module';
import { PlayerModule } from './modules/player/player.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';
import { SharedModule } from './shared/shared.module';
import { ShopController } from './shop/shop.controller';
import { ShopService } from './shop/shop.service';
import { TradesController } from './trades/trades.controller';
import { TradesService } from './trades/trades.service';

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
  ],
  controllers: [
    HealthController,
    CarsController,
    CatalogController,
    PushController,
    GamesController,
    ShopController,
    TradesController,
    AuctionsController,
  ],
  providers: [CarsService, CatalogService, MediaService, PushService, GamesService, ShopService, TradesService, AuctionsService, BotsService],
})
export class AppModule {}
