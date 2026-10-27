import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { Clock, EventBus, PlayerLocks, RandomSource, UnitOfWork } from './application/ports';
import { ClsUnitOfWork, NestEventBus } from './infrastructure/cls-unit-of-work';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaPlayerLocks } from './infrastructure/prisma/transaction';
import { CryptoRandom, SystemClock } from './infrastructure/system';

/** Noyau partagé : base de données, transactions portées par le contexte, événements de domaine, horloge, aléatoire. */
@Global()
@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot({ wildcard: false, ignoreErrors: false }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
            sqlFlavor: 'postgresql',
            defaultTxOptions: { timeout: 15_000, maxWait: 10_000 },
          }),
        }),
      ],
    }),
  ],
  providers: [
    ClsUnitOfWork,
    { provide: UnitOfWork, useExisting: ClsUnitOfWork },
    { provide: EventBus, useClass: NestEventBus },
    { provide: Clock, useClass: SystemClock },
    { provide: RandomSource, useClass: CryptoRandom },
    { provide: PlayerLocks, useClass: PrismaPlayerLocks },
  ],
  exports: [PrismaModule, UnitOfWork, EventBus, Clock, RandomSource, PlayerLocks],
})
export class SharedModule {}
