import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assignRarities } from '../game/rarity';
import { MediaService } from './media.service';
import { SEED_CARS } from './seed-cars';
import { fetchWikidataCars, WikidataCar } from './wikidata';

export type ImportSource = 'wikidata' | 'seed';

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

@Injectable()
export class CatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogService.name);
  private running: Promise<unknown> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  onApplicationBootstrap() {
    const mode = (process.env.CATALOG_AUTO_IMPORT ?? 'wikidata').toLowerCase();
    if (mode === 'off' || process.env.NODE_ENV === 'test') return;
    void this.prisma.car.count().then((count) => {
      if (count > 0) {
        // Reprend un rapatriement de photos/résumés éventuellement interrompu.
        void this.media.syncAll();
        return;
      }
      this.logger.log('Catalogue vide : import automatique en arrière-plan…');
      void this.import(mode === 'seed' ? 'seed' : 'wikidata').catch((err) =>
        this.logger.error(`Import automatique échoué : ${(err as Error).message}`),
      );
    });
  }

  /** Lance un import (une seule exécution à la fois). Wikidata se replie sur le jeu de secours en cas d'échec. */
  import(source: ImportSource, limit = Number(process.env.CATALOG_IMPORT_LIMIT ?? 3000)) {
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        const result = await this.importData(source, limit);
        // Les photos et résumés sont rapatriés ensuite : le jeu est déjà jouable pendant ce temps.
        await this.media.syncAll();
        this.logger.log(`Médias : ${JSON.stringify(await this.media.stats())}`);
        return result;
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async importData(source: ImportSource, limit: number) {
    if (source === 'wikidata') {
      try {
        return await this.importWikidata(limit);
      } catch (err) {
        this.logger.warn(`Wikidata injoignable (${(err as Error).message}) : utilisation du jeu de secours`);
        if ((await this.prisma.car.count()) > 0) throw err;
      }
    }
    return this.importSeed();
  }

  async importWikidata(limit: number) {
    this.logger.log(`Import Wikidata (max ${limit} modèles)…`);
    const cars = await fetchWikidataCars({
      limit,
      onProgress: (done, total) => this.logger.log(`  détails ${done}/${total}`),
    });
    if (!cars.length) throw new Error('Wikidata n’a renvoyé aucune voiture');
    const upserted = await this.upsertWikidata(cars);
    await this.recomputeRarities();
    this.logger.log(`Import Wikidata terminé : ${upserted} cartes`);
    return { source: 'wikidata' as const, cards: upserted };
  }

  private async upsertWikidata(cars: WikidataCar[]) {
    // Les cartes du jeu de secours qui correspondent à un article Wikipédia sont rattachées à Wikidata
    // (on conserve leur identifiant, donc les collections des joueurs).
    const seeds = await this.prisma.car.findMany({
      where: { externalId: { startsWith: 'seed:' } },
      select: { id: true, wikiTitle: true, imageFile: true },
    });
    const seedByTitle = new Map(seeds.filter((s) => s.wikiTitle).map((s) => [s.wikiTitle!, s]));

    let count = 0;
    for (let i = 0; i < cars.length; i += 100) {
      const chunk = cars.slice(i, i + 100);
      const existing = await this.prisma.car.findMany({
        where: { externalId: { in: chunk.map((c) => c.qid) } },
        select: { externalId: true, imageFile: true },
      });
      const previousFile = new Map(existing.map((e) => [e.externalId, e.imageFile]));
      await this.prisma.$transaction(
        chunk.map((c) => {
          const data = {
            name: c.name.slice(0, 200),
            manufacturer: c.manufacturer,
            country: c.country,
            yearStart: c.yearStart,
            yearEnd: c.yearEnd,
            imageUrl: c.imageUrl,
            imageFile: c.imageFile,
            racing: c.racing,
            wikiTitle: c.wikiTitle,
            wikiLang: c.wikiLang,
            powerKw: c.powerKw,
            topSpeedKmh: c.topSpeedKmh,
            massKg: c.massKg,
            lengthMm: c.lengthMm,
            popularity: c.popularity,
            active: true,
          } satisfies Prisma.CarUpdateInput;
          // Photo de référence changée : la copie locale et ses crédits sont à refaire.
          const resetIf = (changed: boolean) =>
            changed ? { imagePath: null, imageAuthor: null, imageLicense: null, imageLicenseUrl: null, imageCheckedAt: null } : {};
          const seed = c.wikiLang === 'fr' && c.wikiTitle ? seedByTitle.get(c.wikiTitle) : undefined;
          if (seed) {
            seedByTitle.delete(c.wikiTitle!);
            return this.prisma.car.update({
              where: { id: seed.id },
              data: { ...data, externalId: c.qid, ...resetIf(seed.imageFile !== c.imageFile) },
            });
          }
          const reset = resetIf(previousFile.has(c.qid) && previousFile.get(c.qid) !== c.imageFile);
          return this.prisma.car.upsert({
            where: { externalId: c.qid },
            create: { externalId: c.qid, ...data },
            update: { ...data, ...reset },
          });
        }),
      );
      count += chunk.length;
    }
    return count;
  }

  async importSeed() {
    this.logger.log(`Import du jeu de secours (${SEED_CARS.length} cartes)…`);
    for (const [name, manufacturer, country, yearStart, yearEnd, popularity, wikiTitle] of SEED_CARS) {
      const externalId = `seed:${slug(name)}`;
      const data = { name, manufacturer, country, yearStart, yearEnd, popularity, wikiTitle, wikiLang: 'fr' };
      await this.prisma.car.upsert({ where: { externalId }, create: { externalId, ...data }, update: data });
    }
    await this.recomputeRarities();
    return { source: 'seed' as const, cards: SEED_CARS.length };
  }

  /** Recalcule la rareté de toutes les cartes à partir de leur notoriété. */
  async recomputeRarities() {
    const cars = await this.prisma.car.findMany({
      where: { active: true },
      select: { id: true },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
    });
    const map = assignRarities(cars.map((c) => c.id));
    const groups = new Map<string, number[]>();
    for (const [id, rarity] of map) groups.set(rarity, [...(groups.get(rarity) ?? []), id]);
    await this.prisma.$transaction(
      [...groups].map(([rarity, ids]) =>
        this.prisma.car.updateMany({ where: { id: { in: ids } }, data: { rarity: rarity as never } }),
      ),
    );
  }
}
