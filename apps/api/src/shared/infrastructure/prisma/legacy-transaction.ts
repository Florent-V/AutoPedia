import { Prisma } from '@prisma/client';
import { ClsUnitOfWork } from '../cls-unit-of-work';

/**
 * Pont de migration : exécute un ancien service dans l'unité de travail (transaction portée par le contexte),
 * pour qu'il partage sa transaction avec les nouveaux services qu'il appelle.
 * Disparaît quand tous les contextes sont migrés.
 */
export function legacyTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, _options?: unknown): Promise<T> {
  const uow = ClsUnitOfWork.instance;
  if (!uow) throw new Error('Unité de travail non initialisée');
  return uow.run(() => fn(uow.tx as Prisma.TransactionClient));
}
