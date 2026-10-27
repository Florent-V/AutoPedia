import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CatalogModule } from '../catalog/catalog.module';
import { CollectionModule } from '../collection/collection.module';
import { ProgressionModule } from '../progression/progression.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { PlayerProvisioning } from './application/player-provisioning';
import { MeController } from './http/me.controller';
import { ProvisionPlayerInterceptor } from './http/provision-player.interceptor';

/** Joueur : création de la fiche et profil composé (`/me`). */
@Module({
  imports: [CollectionModule, ProgressionModule, StatisticsModule, CatalogModule],
  controllers: [MeController],
  providers: [PlayerProvisioning, { provide: APP_INTERCEPTOR, useClass: ProvisionPlayerInterceptor }],
  exports: [PlayerProvisioning],
})
export class PlayerModule {}
