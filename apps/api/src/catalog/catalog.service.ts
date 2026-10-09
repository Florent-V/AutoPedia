import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assignRarities } from '../game/rarity';
import { fetchWikiSummary } from './http';
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

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    const mode = (process.env.CATALOG_AUTO_IMPORT ?? 'wikidata').toLowerCase();
    if (mode === 'off' || process.env.NODE_ENV === 'test') return;
    void this.prisma.car.count().then((count) => {
      if (count > 0) return;
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
        if (source === 'wikidata') {
          try {
            return await this.importWikidata(limit);
          } catch (err) {
            this.logger.warn(`Wikidata injoignable (${(err as Error).message}) : utilisation du jeu de secours`);
            if ((await this.prisma.car.count()) > 0) throw err;
          }
        }
        return await this.importSeed();
      } finally {
        this.running = null;
      }
    })();
    return this.running;
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
      select: { id: true, wikiTitle: true },
    });
    const seedByTitle = new Map(seeds.filter((s) => s.wikiTitle).map((s) => [s.wikiTitle!, s.id]));

    let count = 0;
    for (let i = 0; i < cars.length; i += 100) {
      const chunk = cars.slice(i, i + 100);
      await this.prisma.$transaction(
        chunk.map((c) => {
          const data = {
            name: c.name.slice(0, 200),
            manufacturer: c.manufacturer,
            country: c.country,
            yearStart: c.yearStart,
            yearEnd: c.yearEnd,
            imageUrl: c.imageUrl,
            wikiTitle: c.wikiTitle,
            wikiLang: c.wikiLang,
            powerKw: c.powerKw,
            topSpeedKmh: c.topSpeedKmh,
            massKg: c.massKg,
            popularity: c.popularity,
            active: true,
          } satisfies Prisma.CarUpdateInput;
          const seedId = c.wikiLang === 'fr' && c.wikiTitle ? seedByTitle.get(c.wikiTitle) : undefined;
          if (seedId !== undefined) {
            seedByTitle.delete(c.wikiTitle!);
            return this.prisma.car.update({ where: { id: seedId }, data: { ...data, externalId: c.qid } });
          }
          return this.prisma.car.upsert({
            where: { externalId: c.qid },
            create: { externalId: c.qid, ...data },
            update: data,
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
    await this.enrichImages().catch(() => undefined);
    return { source: 'seed' as const, cards: SEED_CARS.length };
  }

  /** Complète les images manquantes à partir des résumés Wikipédia (si le réseau le permet). */
  async enrichImages(max = 500) {
    const cars = await this.prisma.car.findMany({
      where: { imageUrl: null, wikiTitle: { not: null }, summaryFetchedAt: null },
      take: max,
    });
    let ok = 0;
    for (const car of cars) {
      try {
        const s = await fetchWikiSummary(car.wikiLang ?? 'fr', car.wikiTitle!);
        await this.prisma.car.update({
          where: { id: car.id },
          data: {
            imageUrl: s.originalimage?.source ?? s.thumbnail?.source ?? null,
            summary: s.extract ?? null,
            summaryFetchedAt: new Date(),
          },
        });
        ok++;
      } catch {
        if (ok === 0) break; // réseau indisponible : inutile d'insister
      }
    }
    if (ok) this.logger.log(`Images complétées depuis Wikipédia : ${ok}`);
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
