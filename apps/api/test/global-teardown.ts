import { PrismaClient } from '@prisma/client';

/** Arrête l'API de test (et le worker Symfony) puis supprime la base temporaire de ce lancement (sauf E2E_KEEP_DB=1). */
export default async function globalTeardown() {
  for (const p of [globalThis.__E2E_SERVER__, globalThis.__E2E_WORKER__]) {
    if (!p?.pid || p.exitCode !== null) continue;
    const pid = p.pid;
    // Signal envoyé au groupe de processus (lancé en « detached ») : serveur et sous-processus.
    await new Promise<void>((resolve) => {
      p.once('exit', () => resolve());
      process.kill(-pid, 'SIGTERM');
      setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          /* déjà arrêté */
        }
      }, 5000).unref();
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
