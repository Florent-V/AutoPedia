import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Car, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { HttpError, mediaWikiQuery, politeFetch } from './http';

export const MEDIA_DIR = resolve(process.env.MEDIA_DIR ?? join(process.cwd(), 'media'));
/** Largeur des photos stockées (les cartes font au plus ~360 px de large, ×2 pour les écrans haute densité). */
const IMAGE_WIDTH = 640;
/** Les miniatures Wikimedia existent en tailles standard : demander une taille standard évite de solliciter leurs serveurs. */
const SOURCE_WIDTH = 960;
/** Délai avant de retenter une image en échec. */
const RETRY_FAILED_AFTER_MS = 7 * 24 * 3600 * 1000;

interface ImageInfoPage {
  title: string;
  missing?: boolean;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value: string }>;
  }>;
}

interface QueryResponse<P> {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: P[];
  };
}

/** Texte brut à partir du HTML des métadonnées Commons (auteur). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Suit les normalisations/redirections renvoyées par l'API MediaWiki. */
function resolveTitles(input: string[], q: QueryResponse<unknown>['query']): Map<string, string> {
  const norm = new Map((q?.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q?.redirects ?? []).map((n) => [n.from, n.to]));
  return new Map(
    input.map((t) => {
      const n = norm.get(t) ?? t;
      return [t, redir.get(n) ?? n];
    }),
  );
}

export interface MediaStats {
  cards: number;
  withLocalImage: number;
  pendingImages: number;
  withoutImage: number;
  withSummary: number;
}

/** Erreur passagère (débit limité, accès refusé, réseau) : on arrête et on reprendra plus tard. */
function isTransient(err: unknown) {
  if (err instanceof HttpError) return err.status === 403 || err.status === 429 || err.status >= 500;
  // fetch() lève TypeError (« fetch failed ») sur erreur réseau et AbortError sur délai dépassé.
  return err instanceof Error && (err.name === 'TypeError' || err.name === 'AbortError');
}

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private running: Promise<void> | null = null;
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.CATALOG_AUTO_IMPORT === 'off' || process.env.NODE_ENV === 'test') return;
    const hours = Number(process.env.MEDIA_SYNC_HOURS ?? 6);
    if (hours > 0) {
      this.timer = setInterval(() => void this.syncAll(), hours * 3600 * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Rapatrie tout ce qui manque : noms de fichiers des cartes de secours, photos, résumés. Une seule exécution à la fois. */
  syncAll(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        // Commons d'abord (indépendant de Wikipédia), puis les cartes de secours qui passent par Wikipédia.
        await this.syncImages();
        await this.resolveSeedImageFiles();
        await this.syncImages();
        await this.syncSummaries();
      } catch (err) {
        this.logger.warn(
          `Synchronisation des médias interrompue (${(err as Error).message}) : reprise automatique plus tard, ` +
            'ou manuelle avec « node dist/cli/import-catalog media ».',
        );
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  async stats(): Promise<MediaStats> {
    const active = { active: true };
    const [cards, withLocalImage, pendingImages, withoutImage, withSummary] = await Promise.all([
      this.prisma.car.count({ where: active }),
      this.prisma.car.count({ where: { ...active, imagePath: { not: null } } }),
      this.prisma.car.count({ where: { ...active, imagePath: null, imageFile: { not: null } } }),
      this.prisma.car.count({ where: { ...active, imagePath: null, imageFile: null } }),
      this.prisma.car.count({ where: { ...active, summary: { not: null } } }),
    ]);
    return { cards, withLocalImage, pendingImages, withoutImage, withSummary };
  }

  /** Les cartes du jeu de secours n'ont pas de fichier Commons : on prend l'image principale de leur article Wikipédia. */
  async resolveSeedImageFiles() {
    const cars = await this.prisma.car.findMany({
      where: { imageFile: null, wikiTitle: { not: null }, imageCheckedAt: null },
      select: { id: true, wikiTitle: true, wikiLang: true },
    });
    const byLang = new Map<string, typeof cars>();
    for (const c of cars) byLang.set(c.wikiLang ?? 'fr', [...(byLang.get(c.wikiLang ?? 'fr') ?? []), c]);

    for (const [lang, list] of byLang) {
      for (let i = 0; i < list.length; i += 50) {
        const batch = list.slice(i, i + 50);
        const titles = batch.map((c) => c.wikiTitle!);
        const res = await mediaWikiQuery<QueryResponse<{ title: string; pageimage?: string }>>(`${lang}.wikipedia.org`, {
          action: 'query',
          prop: 'pageimages',
          piprop: 'name',
          redirects: '1',
          titles: titles.join('|'),
        });
        const resolved = resolveTitles(titles, res.query);
        const images = new Map((res.query?.pages ?? []).map((p) => [p.title, p.pageimage]));
        for (const c of batch) {
          const file = images.get(resolved.get(c.wikiTitle!) ?? c.wikiTitle!);
          await this.prisma.car.update({
            where: { id: c.id },
            data: file ? { imageFile: file.replace(/_/g, ' ') } : { imageCheckedAt: new Date() },
          });
        }
      }
    }
  }

  /** Télécharge, redimensionne et stocke localement les photos manquantes, avec leurs crédits. */
  async syncImages() {
    await mkdir(join(MEDIA_DIR, 'cars'), { recursive: true });
    const retryBefore = new Date(Date.now() - RETRY_FAILED_AFTER_MS);
    const where: Prisma.CarWhereInput = {
      active: true,
      imagePath: null,
      imageFile: { not: null },
      OR: [{ imageCheckedAt: null }, { imageCheckedAt: { lt: retryBefore } }],
    };
    const total = await this.prisma.car.count({ where });
    if (!total) return;
    this.logger.log(`Photos à rapatrier : ${total}`);

    let done = 0;
    let saved = 0;
    for (;;) {
      const batch = await this.prisma.car.findMany({ where, orderBy: { popularity: 'desc' }, take: 50 });
      if (!batch.length) break;
      const infos = await this.fetchImageInfos(batch.map((c) => c.imageFile!));
      for (const car of batch) {
        const ok = await this.storeImage(car, infos.get(car.imageFile!));
        if (ok) saved++;
        done++;
      }
      this.logger.log(`  photos ${done}/${total} (${saved} enregistrées)`);
    }
  }

  private async fetchImageInfos(files: string[]) {
    const titles = files.map((f) => `File:${f}`);
    const res = await mediaWikiQuery<QueryResponse<ImageInfoPage>>('commons.wikimedia.org', {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: String(SOURCE_WIDTH),
      iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|AttributionRequired',
      redirects: '1',
      titles: titles.join('|'),
    });
    const resolved = resolveTitles(titles, res.query);
    const pages = new Map((res.query?.pages ?? []).map((p) => [p.title, p]));
    return new Map(files.map((f, i) => [f, pages.get(resolved.get(titles[i]) ?? titles[i])]));
  }

  private async storeImage(car: Car, page: ImageInfoPage | undefined): Promise<boolean> {
    const info = page?.imageinfo?.[0];
    const source = info?.thumburl ?? info?.url;
    if (!info || !source || page?.missing) {
      await this.prisma.car.update({ where: { id: car.id }, data: { imageCheckedAt: new Date() } });
      return false;
    }
    try {
      const res = await politeFetch(source, {}, { timeoutMs: 30_000 });
      const input = Buffer.from(await res.arrayBuffer());
      const output = await sharp(input, { failOn: 'none' })
        .rotate()
        .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      const hash = createHash('sha1').update(car.imageFile!).digest('hex').slice(0, 8);
      const rel = `cars/${car.externalId.replace(/[^a-zA-Z0-9-]/g, '_')}-${hash}.webp`;
      await writeFile(join(MEDIA_DIR, rel), output);
      const meta = info.extmetadata ?? {};
      await this.prisma.car.update({
        where: { id: car.id },
        data: {
          imagePath: rel,
          imageAuthor: meta.Artist ? stripHtml(meta.Artist.value) || null : null,
          imageLicense: meta.LicenseShortName?.value ?? null,
          imageLicenseUrl: meta.LicenseUrl?.value ?? null,
          imageCheckedAt: new Date(),
        },
      });
      return true;
    } catch (err) {
      if (isTransient(err)) throw err;
      this.logger.warn(`Photo inutilisable pour « ${car.name} » : ${(err as Error).message}`);
      await this.prisma.car.update({ where: { id: car.id }, data: { imageCheckedAt: new Date() } });
      return false;
    }
  }

  /** Récupère les résumés Wikipédia manquants, par lots de 20 articles. */
  async syncSummaries() {
    const cars = await this.prisma.car.findMany({
      where: { active: true, summary: null, summaryFetchedAt: null, wikiTitle: { not: null } },
      select: { id: true, wikiTitle: true, wikiLang: true },
      orderBy: { popularity: 'desc' },
    });
    if (!cars.length) return;
    this.logger.log(`Résumés à récupérer : ${cars.length}`);
    const byLang = new Map<string, typeof cars>();
    for (const c of cars) byLang.set(c.wikiLang ?? 'fr', [...(byLang.get(c.wikiLang ?? 'fr') ?? []), c]);

    let done = 0;
    for (const [lang, list] of byLang) {
      for (let i = 0; i < list.length; i += 20) {
        const batch = list.slice(i, i + 20);
        const titles = batch.map((c) => c.wikiTitle!);
        const res = await mediaWikiQuery<QueryResponse<{ title: string; extract?: string }>>(`${lang}.wikipedia.org`, {
          action: 'query',
          prop: 'extracts',
          exintro: '1',
          explaintext: '1',
          exsentences: '5',
          exlimit: '20',
          redirects: '1',
          titles: titles.join('|'),
        });
        const resolved = resolveTitles(titles, res.query);
        const extracts = new Map((res.query?.pages ?? []).map((p) => [p.title, p.extract]));
        const now = new Date();
        await this.prisma.$transaction(
          batch.map((c) =>
            this.prisma.car.update({
              where: { id: c.id },
              data: { summary: extracts.get(resolved.get(c.wikiTitle!) ?? c.wikiTitle!)?.trim() || null, summaryFetchedAt: now },
            }),
          ),
        );
        done += batch.length;
        this.logger.log(`  résumés ${done}/${cars.length}`);
      }
    }
  }
}
