import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { API_DIR, E2E_API, E2E_BACKEND, E2E_PORT, serverDatabaseUrl, serverEnv, SYMFONY_DIR, symfonyEnv, withDatabase } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __E2E_SERVER__: ChildProcess | undefined;
  /** Symfony : worker du Scheduler (tâches de fond), lancé à côté du serveur. */
  // eslint-disable-next-line no-var
  var __E2E_WORKER__: ChildProcess | undefined;
  // eslint-disable-next-line no-var
  var __E2E_DATABASE__: { admin: string; name: string } | undefined;
}

/**
 * Crée une base temporaire « garage_e2e_… » propre à ce lancement (aucune base existante n'est modifiée),
 * y applique les migrations et le jeu de cartes de secours (avec des caractéristiques),
 * puis lance l'API compilée (dist/) comme en production. Lancer `npm run build` avant (fait par `npm run test:e2e`).
 * Avec E2E_BACKEND=symfony (`npm run test:e2e:symfony`), c'est l'API Symfony qui est préparée et lancée.
 */
export default async function globalSetup() {
  const admin = serverDatabaseUrl();
  const name = `garage_e2e_${Date.now()}_${process.pid}`;
  const maintenance = new PrismaClient({ datasources: { db: { url: admin } } });
  await maintenance.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  await maintenance.$disconnect();
  globalThis.__E2E_DATABASE__ = { admin, name };
  const databaseUrl = withDatabase(admin, name);
  process.env.E2E_RUN_DATABASE_URL = databaseUrl;
  const env = E2E_BACKEND === 'symfony' ? symfonyEnv(databaseUrl) : serverEnv(databaseUrl);
  const cwd = E2E_BACKEND === 'symfony' ? SYMFONY_DIR : API_DIR;
  const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd, env, stdio: 'pipe' });

  if (E2E_BACKEND === 'symfony') {
    run('php', ['bin/console', 'cache:clear']);
    run('php', ['bin/console', 'doctrine:migrations:migrate', '--no-interaction']);
    run('php', ['bin/console', 'app:catalog:import', 'seed', '--no-media']);
  } else {
    run('npx', ['prisma', 'migrate', 'deploy']);
    run('node', [join('dist', 'cli', 'import-catalog'), 'seed']);
  }
  // Les cartes de secours n'ont pas de caractéristiques : on en fixe de déterministes pour que tous les jeux fonctionnent.
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.$executeRaw`UPDATE "car" SET "massKg" = 700 + ("id" * 137) % 1800, "powerKw" = 40 + ("id" * 53) % 400,
    "topSpeedKmh" = 120 + ("id" * 29) % 220, "lengthMm" = 3000 + ("id" * 71) % 2200`;
  await db.$disconnect();
  // Groupe de processus dédié (detached) : l'arrêt emporte aussi les workers du serveur PHP.
  const start = (cmd: string, args: string[]) => spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  if (E2E_BACKEND === 'symfony') {
    // variables_order=EGPCS : le serveur intégré expose alors l'environnement dans $_ENV, que Dotenv ne remplace pas par .env.
    globalThis.__E2E_SERVER__ = start('php', ['-d', 'expose_php=0', '-d', 'variables_order=EGPCS', '-S', `127.0.0.1:${E2E_PORT}`, '-t', 'public', 'public/index.php']);
    globalThis.__E2E_WORKER__ = start('php', ['bin/console', 'messenger:consume', 'scheduler_default', '--quiet']);
  } else {
    globalThis.__E2E_SERVER__ = start('node', [join('dist', 'main')]);
  }
  // Journal du serveur de test : test/.logs/api.log (utile pour comprendre une erreur 500).
  mkdirSync(join(API_DIR, 'test', '.logs'), { recursive: true });
  const logFile = createWriteStream(join(API_DIR, 'test', '.logs', 'api.log'));
  const logs: string[] = [];
  const server = globalThis.__E2E_SERVER__;
  const worker = globalThis.__E2E_WORKER__;
  for (const stream of [server.stdout, server.stderr, worker?.stdout, worker?.stderr]) {
    stream?.on('data', (d) => {
      logs.push(String(d));
      logFile.write(d);
    });
  }

  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${E2E_API}/api/health`);
      // Le backend attendu doit répondre (et pas un autre serveur resté sur le port).
      if (res.ok && (E2E_BACKEND === 'nestjs' || (await res.json()).backend === 'symfony')) return;
    } catch {
      /* pas encore prêt */
    }
    if (server.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const p of [server, worker]) if (p?.pid) process.kill(-p.pid, 'SIGKILL');
  throw new Error(`L'API de test n'a pas démarré :\n${logs.join('')}`);
}
