import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { EventBus, UnitOfWork } from '../application/ports';
import { DomainEvent } from '../domain/domain-event';
import { AFTER_COMMIT } from './events';
import { PrismaService } from './prisma/prisma.service';

const PENDING = Symbol('pending-after-commit-events');

/**
 * Unité de travail fondée sur nestjs-cls : la transaction Prisma est portée par le contexte
 * de la requête (ou de la tâche de fond), et les repositories l'utilisent via `TransactionHost.tx`.
 */
@Injectable()
export class ClsUnitOfWork extends UnitOfWork {
  private readonly logger = new Logger('UnitOfWork');

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    private readonly cls: ClsService,
    private readonly emitter: EventEmitter2,
  ) {
    super();
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    const exec = async () => {
      if (this.txHost.isTransactionActive()) return work();
      // Le tableau est créé dans le contexte parent : la transaction (contexte enfant) le remplit par référence.
      const pending: DomainEvent[] = [];
      this.cls.set(PENDING, pending);
      try {
        const result = await this.txHost.withTransaction(work);
        for (const event of pending) {
          this.emitter.emitAsync(AFTER_COMMIT + event.eventName, event).catch((err: Error) =>
            this.logger.error(`Abonné après validation en échec (${event.eventName}) : ${err.message}`),
          );
        }
        return result;
      } finally {
        this.cls.set(PENDING, undefined);
      }
    };
    return this.cls.isActive() ? exec() : this.cls.run(exec);
  }

  /** File des événements à diffuser après validation, si une transaction est en cours. */
  pendingQueue(): DomainEvent[] | undefined {
    return this.cls.isActive() ? this.cls.get<DomainEvent[] | undefined>(PENDING) : undefined;
  }
}

@Injectable()
export class NestEventBus extends EventBus {
  constructor(
    private readonly emitter: EventEmitter2,
    private readonly uow: ClsUnitOfWork,
  ) {
    super();
  }

  async publish(...events: DomainEvent[]) {
    for (const event of events) {
      // Abonnés transactionnels : attendus, une erreur remonte et annule la transaction.
      await this.emitter.emitAsync(event.eventName, event);
      const queue = this.uow.pendingQueue();
      if (queue) queue.push(event);
      else void this.emitter.emitAsync(AFTER_COMMIT + event.eventName, event).catch(() => undefined);
    }
  }
}
