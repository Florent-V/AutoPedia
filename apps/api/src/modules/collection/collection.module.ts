import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { BoostersService } from './application/boosters.service';
import { CardsService } from './application/cards.service';
import { CollectionQueryService } from './application/collection.query';
import { BoosterReserveRepository } from './domain/booster-reserve';
import { CarPool, OwnedCards } from './domain/ports';
import { BoostersController } from './http/boosters.controller';
import { CarsController } from './http/cars.controller';
import { CollectionController } from './http/collection.controller';
import {
  CatalogCarPool,
  PrismaBoosterReserveRepository,
  PrismaOwnedCards,
} from './infrastructure/prisma-collection.repositories';

/** Contexte « Collection » : cartes possédées, réserve et ouverture des boosters. */
@Module({
  imports: [CatalogModule, StatisticsModule],
  controllers: [BoostersController, CollectionController, CarsController],
  providers: [
    BoostersService,
    CardsService,
    CollectionQueryService,
    { provide: BoosterReserveRepository, useClass: PrismaBoosterReserveRepository },
    { provide: OwnedCards, useClass: PrismaOwnedCards },
    { provide: CarPool, useClass: CatalogCarPool },
  ],
  exports: [BoostersService, CardsService],
})
export class CollectionModule {}
