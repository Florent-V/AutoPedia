import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PlayerLocks } from '../../application/ports';
import { PrismaService } from './prisma.service';

/** Accès à la base dans la transaction en cours (ou hors transaction pour les lectures). */
export type Db = TransactionHost<TransactionalAdapterPrisma<PrismaService>>;
export const Db = TransactionHost;

@Injectable()
export class PrismaPlayerLocks extends PlayerLocks {
  constructor(private readonly db: Db) {
    super();
  }

  async lock(...userIds: string[]) {
    if (!this.db.isTransactionActive()) throw new Error('PlayerLocks.lock doit être appelé dans une unité de travail');
    for (const id of [...new Set(userIds)].sort()) {
      await this.db.tx.$queryRaw`SELECT 1 FROM "player" WHERE "userId" = ${id} FOR UPDATE`;
    }
  }
}
