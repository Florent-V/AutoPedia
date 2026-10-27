import { PrismaClient } from '@prisma/client';

/** Arrête l'API de test et supprime la base temporaire créée par ce lancement (sauf E2E_KEEP_DB=1). */
export default async function globalTeardown() {
  const server = globalThis.__E2E_SERVER__;
  if (server && server.exitCode === null) {
    await new Promise<void>((resolve) => {
      server.once('exit', () => resolve());
      server.kill('SIGTERM');
      setTimeout(() => server.kill('SIGKILL'), 5000).unref();
    });
  }
  const database = globalThis.__E2E_DATABASE__;
  if (!database || process.env.E2E_KEEP_DB === '1') return;
  // Garde-fou : on ne supprime que la base créée par global-setup pendant ce lancement.
  if (!/^garage_e2e_\d+_\d+$/.test(database.name)) return;
  const maintenance = new PrismaClient({ datasources: { db: { url: database.admin } } });
  await maintenance.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`);
  await maintenance.$disconnect();
}
