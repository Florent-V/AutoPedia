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
  ],
  providers: [PlayerService, BoostersService, CollectionService, CarsService, AchievementsService, CatalogService, MediaService, PushService],
})
export class AppModule {}
