import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CollectionModule } from '../collection/collection.module';
import { WalletModule } from '../wallet/wallet.module';
import { GamesService } from './application/games.service';
import { GameSessionRepository, QuestionFactory } from './domain/ports';
import { GamesController } from './http/games.controller';
import { PrismaGameSessionRepository } from './infrastructure/prisma-game-session.repository';
import { SqlQuestionFactory } from './infrastructure/sql-question-factory';

/** Contexte « Mini-jeux » : parties, questions, gains en crédits ou en cartes. */
@Module({
  imports: [WalletModule, CollectionModule, CatalogModule],
  controllers: [GamesController],
  providers: [
    GamesService,
    { provide: GameSessionRepository, useClass: PrismaGameSessionRepository },
    { provide: QuestionFactory, useClass: SqlQuestionFactory },
  ],
})
export class GamesModule {}
