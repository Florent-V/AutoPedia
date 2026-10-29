/** Paramètres de l'environnement de test de bout en bout, partagés par la mise en place et les tests. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const API_DIR = join(__dirname, '..');
/** Backend testé : l'API NestJS (par défaut) ou sa version Symfony (apps/api-symfony), avec les mêmes tests. */
export const E2E_BACKEND: 'nestjs' | 'symfony' = process.env.E2E_BACKEND === 'symfony' ? 'symfony' : 'nestjs';
export const SYMFONY_DIR = join(API_DIR, '..', 'api-symfony');
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3101);
export const E2E_API = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_ORIGIN = 'http://localhost:3000';

/** Serveur PostgreSQL utilisé : E2E_DATABASE_URL, sinon DATABASE_URL (variable ou .env). Seule l'adresse du serveur est reprise. */
export function serverDatabaseUrl() {
  let base = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    try {
      const line = readFileSync(join(API_DIR, '.env'), 'utf8')
        .split('\n')
        .find((l) => l.startsWith('DATABASE_URL='));
      base = line?.slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
    } catch {
      /* pas de .env */
    }
  }
  if (!base) throw new Error('Définir E2E_DATABASE_URL (ou DATABASE_URL) pour lancer les tests de bout en bout');
  return base;
}

/** Base temporaire propre à ce lancement (créée par la mise en place, supprimée à la fin). */
export function withDatabase(url: string, name: string) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

/** Adresse de la base de test du lancement en cours (fixée par global-setup). */
export function testDatabaseUrl() {
  const url = process.env.E2E_RUN_DATABASE_URL;
  if (!url) throw new Error('Base de test absente : lancer les tests avec `npm run test:e2e`');
  return url;
}

/** Variables du serveur lancé pour les tests : tâches de fond accélérées, aucun appel réseau sortant. */
export function serverEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(E2E_PORT),
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
    BETTER_AUTH_URL: E2E_ORIGIN,
    WEB_ORIGIN: E2E_ORIGIN,
    SHOP_SECRET: 'e2e-shop-secret',
    CATALOG_AUTO_IMPORT: 'off',
    MEDIA_SYNC: 'off',
    MEDIA_DIR: join(API_DIR, 'test', '.media'),
    BOTS_ENABLED: 'false',
    BACKGROUND_JOBS: 'on',
    AUCTION_SETTLE_SECONDS: '1',
    TRADE_EXPIRE_SECONDS: '1',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
    ADMIN_TOKEN: 'e2e-admin-token-0123456789',
    MARKET_MIN_ACCOUNT_HOURS: '24',
    MARKET_MIN_BOOSTERS: '3',
    TRADE_MAX_RARITY_GAP: '1',
  };
}

/** Variables du backend Symfony : mêmes réglages, au format attendu par Doctrine et Symfony. */
export function symfonyEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  url.search = '?serverVersion=16&charset=utf8';
  return {
    ...serverEnv(databaseUrl),
    APP_ENV: 'prod',
    APP_DEBUG: '0',
    APP_SECRET: 'e2e-app-secret-e2e-app-secret-0123',
    DATABASE_URL: url.toString(),
    // La limite des tentatives de connexion est coupée comme pour Better Auth sous NODE_ENV=test.
    AUTH_RATE_LIMIT: 'off',
    LOG_LEVEL: 'warning',
    PHP_CLI_SERVER_WORKERS: '8',
  };
}
