/**
 * Client HTTP « poli » pour les services Wikimedia :
 * - User-Agent identifiable avec un contact (exigé par la politique robots de Wikimedia),
 * - espacement minimal entre deux requêtes vers un même domaine,
 * - nouvelles tentatives sur 429 / 502 / 503 / 504 en respectant l'en-tête Retry-After.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('Wikimedia');
const contact = process.env.WIKI_CONTACT ?? 'https://github.com/florent-v/autopedia';
export const USER_AGENT = process.env.WIKI_USER_AGENT ?? `GarageCardGame/0.2 (${contact})`;

/** Jeton personnel Wikimedia (facultatif) : relève les limites de débit. */
const WIKIMEDIA_TOKEN = process.env.WIKIMEDIA_TOKEN ?? '';

const MIN_INTERVAL_MS: Record<string, number> = {
  'query.wikidata.org': 1000,
  'commons.wikimedia.org': 1000,
  'upload.wikimedia.org': 250,
  'thumb.wikimedia.org': 250,
};
const DEFAULT_INTERVAL_MS = 500;

const nextSlot = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitTurn(host: string) {
  const interval = MIN_INTERVAL_MS[host] ?? (host.endsWith('wikipedia.org') ? 1000 : DEFAULT_INTERVAL_MS);
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + interval);
  if (slot > now) await sleep(slot - now);
}

function isWikimedia(host: string) {
  return /(^|\.)(wikipedia|wikimedia|wikidata)\.org$/.test(host);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} sur ${url.slice(0, 120)}`);
  }
}

export interface PoliteOptions {
  timeoutMs?: number;
  retries?: number;
  /** Attente maximale acceptée pour un Retry-After (au-delà, on abandonne). */
  maxRetryAfterMs?: number;
}

export async function politeFetch(url: string, init: RequestInit = {}, opts: PoliteOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, retries = 5, maxRetryAfterMs = 120_000 } = opts;
  const host = new URL(url).host;
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Api-User-Agent': USER_AGENT,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (WIKIMEDIA_TOKEN && isWikimedia(host)) headers.Authorization = `Bearer ${WIKIMEDIA_TOKEN}`;

  for (let attempt = 0; ; attempt++) {
    await waitTurn(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= retries) throw err;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    clearTimeout(timer);

    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      const header = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(header) && header > 0 ? header * 1000 : 5000 * 2 ** attempt;
      if (wait > maxRetryAfterMs) throw new HttpError(res.status, url);
      logger.warn(`${host} : HTTP ${res.status}, nouvelle tentative dans ${Math.round(wait / 1000)} s`);
      await res.body?.cancel().catch(() => undefined);
      // Ralentit aussi les requêtes suivantes vers ce domaine.
      nextSlot.set(host, Date.now() + wait);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new HttpError(res.status, url);
    }
    return res;
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const res = await politeFetch(url, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}) } }, { timeoutMs });
  return (await res.json()) as T;
}

export interface WikiSummary {
  title: string;
  extract?: string;
  description?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

/** Résumé d'un seul article (utilisé à la volée quand une fiche n'a pas encore de résumé). */
export function fetchWikiSummary(lang: string, title: string, timeoutMs = 8_000) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  return politeFetch(url, { headers: { Accept: 'application/json' } }, { timeoutMs, retries: 1, maxRetryAfterMs: 3000 }).then(
    (r) => r.json() as Promise<WikiSummary>,
  );
}

/** Appelle l'API MediaWiki (action=query…) d'un wiki donné. */
export function mediaWikiQuery<T>(host: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  return fetchJson<T>(`https://${host}/w/api.php?${qs.toString()}`);
}
