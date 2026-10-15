import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Verrouille les lignes « player » des joueurs concernés, toujours dans le même ordre
 * pour éviter les interblocages lors des échanges entre deux joueurs.
 */
export async function lockPlayers(tx: Tx, ...userIds: string[]) {
  for (const id of [...new Set(userIds)].sort()) {
    await tx.$queryRaw`SELECT 1 FROM "player" WHERE "userId" = ${id} FOR UPDATE`;
  }
}

/** Ajoute (montant > 0) ou retire (montant < 0) des crédits, avec une ligne dans le journal. */
export async function moveCredits(tx: Tx, userId: string, amount: number, reason: string, ref?: string) {
  if (!Number.isInteger(amount) || amount === 0) return;
  const player = await tx.player.findUniqueOrThrow({ where: { userId }, select: { credits: true } });
  if (amount < 0 && player.credits + amount < 0) {
    throw new ConflictException(`Crédits insuffisants (${player.credits} disponibles, ${-amount} nécessaires)`);
  }
  const updated = await tx.player.update({
    where: { userId },
    data: { credits: { increment: amount }, ...(amount > 0 ? { creditsEarned: { increment: amount } } : {}) },
    select: { credits: true },
  });
  await tx.creditTransaction.create({ data: { userId, amount, reason, ref, balance: updated.credits } });
  return updated.credits;
}

/** Ajoute un exemplaire d'une carte à la collection. */
export async function addCard(tx: Tx, userId: string, carId: number, now = new Date()) {
  const existing = await tx.userCard.findUnique({ where: { userId_carId: { userId, carId } }, select: { quantity: true } });
  const card = await tx.userCard.upsert({
    where: { userId_carId: { userId, carId } },
    create: { userId, carId, quantity: 1, firstObtainedAt: now, lastObtainedAt: now },
    update: { quantity: { increment: 1 }, lastObtainedAt: now },
  });
  return { quantity: card.quantity, isNew: !existing };
}

/** Retire un exemplaire d'une carte (la ligne disparaît au dernier exemplaire). */
export async function removeCard(tx: Tx, userId: string, carId: number) {
  const card = await tx.userCard.findUnique({ where: { userId_carId: { userId, carId } } });
  if (!card || card.quantity < 1) throw new BadRequestException('Vous ne possédez pas cette carte');
  if (card.quantity === 1) await tx.userCard.delete({ where: { userId_carId: { userId, carId } } });
  else await tx.userCard.update({ where: { userId_carId: { userId, carId } }, data: { quantity: { decrement: 1 } } });
  return card.quantity - 1;
}
