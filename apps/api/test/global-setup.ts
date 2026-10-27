import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { API_DIR, E2E_API, serverDatabaseUrl, serverEnv, withDatabase } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __E2E_SERVER__: ChildProcess | undefined;
  // eslint-disable-next-line no-var
  var __E2E_DATABASE__: { admin: string; name: string } | undefined;
}

/**
 * Crée une base temporaire « garage_e2e_… » propre à ce lancement (aucune base existante n'est modifiée),
 * y applique les migrations et le jeu de cartes de secours (avec des caractéristiques),
 * puis lance l'API compilée (dist/) comme en production. Lancer `npm run build` avant (fait par `npm run test:e2e`).
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
  const env = serverEnv(databaseUrl);
  const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: API_DIR, env, stdio: 'pipe' });

  run('npx', ['prisma', 'migrate', 'deploy']);
  run('node', [join('dist', 'cli', 'import-catalog'), 'seed']);
  // Les cartes de secours n'ont pas de caractéristiques : on en fixe de déterministes pour que tous les jeux fonctionnent.
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.$executeRaw`UPDATE "car" SET "massKg" = 700 + ("id" * 137) % 1800, "powerKw" = 40 + ("id" * 53) % 400,
    "topSpeedKmh" = 120 + ("id" * 29) % 220, "lengthMm" = 3000 + ("id" * 71) % 2200`;
  await db.$disconnect();
  globalThis.__E2E_SERVER__ = spawn('node', [join('dist', 'main')], { cwd: API_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  // Journal du serveur de test : test/.logs/api.log (utile pour comprendre une erreur 500).
  mkdirSync(join(API_DIR, 'test', '.logs'), { recursive: true });
  const logFile = createWriteStream(join(API_DIR, 'test', '.logs', 'api.log'));
  const logs: string[] = [];
  for (const stream of [globalThis.__E2E_SERVER__.stdout, globalThis.__E2E_SERVER__.stderr]) {
    stream?.on('data', (d) => {
      logs.push(String(d));
      logFile.write(d);
    });
  }

  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${E2E_API}/api/health`);
      if (res.ok) return;
    } catch {
      /* pas encore prêt */
    }
    if (globalThis.__E2E_SERVER__.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  globalThis.__E2E_SERVER__.kill();
  throw new Error(`L'API de test n'a pas démarré :\n${logs.join('')}`);
}
