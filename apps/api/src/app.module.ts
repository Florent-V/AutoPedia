import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements/achievements.controller';
import { AchievementsService } from './achievements/achievements.service';
import { AuthModule } from './auth/auth.module';
import { BoostersController } from './boosters/boosters.controller';
import { BoostersService } from './boosters/boosters.service';
import { CarsController } from './cars/cars.controller';
import { CarsService } from './cars/cars.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { MediaService } from './catalog/media.service';
import { CollectionController } from './collection/collection.controller';
import { CollectionService } from './collection/collection.service';
import { HealthController } from './health.controller';
import { PlayerController } from './player/player.controller';
import { PlayerService } from './player/player.service';
import { PrismaModule } from './prisma/prisma.module';
import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';
import { GamesController } from './games/games.controller';
import { GamesService } from './games/games.service';
import { ShopController } from './shop/shop.controller';
import { ShopService } from './shop/shop.service';
import { TradesController } from './trades/trades.controller';
import { TradesService } from './trades/trades.service';
import { WalletController } from './economy/wallet.controller';
import { AuctionsController } from './auctions/auctions.controller';
import { AuctionsService } from './auctions/auctions.service';
import { DailyController } from './daily/daily.controller';
import { DailyService } from './daily/daily.service';
import { BotsService } from './bots/bots.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    HealthController,
    PlayerController,
    BoostersController,
    CollectionController,
    CarsController,
    AchievementsController,
    CatalogController,
    PushController,
    GamesController,
    ShopController,
    TradesController,
    WalletController,
    AuctionsController,
    DailyController,
  ],
  providers: [PlayerService, BoostersService, CollectionService, CarsService, AchievementsService, CatalogService, MediaService, PushService, GamesService, ShopService, TradesService, AuctionsService, DailyService, BotsService],
})
export class AppModule {}
