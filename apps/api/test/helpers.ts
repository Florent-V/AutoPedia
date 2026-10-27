import { PrismaClient, Rarity } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { E2E_API, E2E_ORIGIN, testDatabaseUrl } from './env';

/** Accès direct à la base de test : préparer un état (crédits, date…) et vérifier les invariants. Jamais pour tricher côté API. */
export const db = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

export type Agent = ReturnType<typeof request.agent>;

export interface TestPlayer {
  agent: Agent;
  id: string;
  email: string;
}

/** Client sans session. */
export const anonymous = () => request.agent(E2E_API).set('Origin', E2E_ORIGIN);

/** Inscrit un nouveau joueur ; l'agent garde le cookie de session. */
export async function newPlayer(name = 'Testeur'): Promise<TestPlayer> {
  const agent = anonymous();
  const email = `e2e-${randomUUID()}@test.local`;
  await agent.post('/api/auth/sign-up/email').send({ name, email, password: 'motdepasse-e2e' }).expect(200);
  const me = await agent.get('/api/me').expect(200);
  return { agent, id: me.body.user.id, email };
}

/**
 * Joueur admis au marché : compte de plus de 24 h ayant ouvert au moins 3 boosters
 * (garde-fous contre les comptes multiples). On vieillit le compte en base, sans passer par l'API.
 */
export async function newTrader(name = 'Marchand'): Promise<TestPlayer> {
  const p = await newPlayer(name);
  await db.user.update({ where: { id: p.id }, data: { createdAt: new Date(Date.now() - 48 * 3600_000) } });
  await db.player.update({ where: { userId: p.id }, data: { boostersOpened: 3 } });
  return p;
}

/** Fixe le solde d'un joueur en passant par le journal (l'invariant solde = départ + journal reste vrai). */
export async function setCredits(userId: string, credits: number) {
  const player = await db.player.findUniqueOrThrow({ where: { userId } });
  const delta = credits - player.credits;
  if (!delta) return;
  await db.$transaction([
    db.player.update({ where: { userId }, data: { credits } }),
    db.creditTransaction.create({ data: { userId, amount: delta, reason: 'test', balance: credits } }),
  ]);
}

export async function giveCard(userId: string, carId: number, quantity = 1) {
  const now = new Date();
  await db.userCard.upsert({
    where: { userId_carId: { userId, carId } },
    create: { userId, carId, quantity, firstObtainedAt: now, lastObtainedAt: now },
    update: { quantity: { increment: quantity } },
  });
}

export async function quantityOf(userId: string, carId: number) {
  return (await db.userCard.findUnique({ where: { userId_carId: { userId, carId } } }))?.quantity ?? 0;
}

export async function creditsOf(userId: string) {
  return (await db.player.findUniqueOrThrow({ where: { userId } })).credits;
}

/** Solde hors récompenses de succès (versées automatiquement quand un palier est atteint). */
export async function creditsWithoutAchievements(userId: string) {
  const bonus = await db.creditTransaction.aggregate({ where: { userId, reason: 'achievement' }, _sum: { amount: true } });
  return (await creditsOf(userId)) - (bonus._sum.amount ?? 0);
}

export async function carOfRarity(rarity: Rarity, skip = 0) {
  return db.car.findFirstOrThrow({ where: { rarity, active: true }, orderBy: { id: 'asc' }, skip });
}

/** Attend qu'une condition soit vraie (tâches de fond). */
export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 10_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error('Délai dépassé');
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Statuts HTTP d'un lot de requêtes lancées en parallèle, triés. */
export async function statuses(requests: Array<PromiseLike<{ status: number }>>) {
  return (await Promise.all(requests)).map((r) => r.status).sort();
}

afterAll(() => db.$disconnect());
