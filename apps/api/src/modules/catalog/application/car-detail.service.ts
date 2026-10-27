import { Injectable, Logger } from '@nestjs/common';
import { NotFound } from '../../../shared/domain/errors';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { fetchWikiSummary } from '../infrastructure/wikimedia/http';
import { imageCreditOf, toCardDto } from './card-view';

const SUMMARY_TTL_MS = 30 * 24 * 3600 * 1000;

@Injectable()
export class CarDetailService {
  private readonly logger = new Logger(CarDetailService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fiche complète d'une carte ; le résumé Wikipédia est rafraîchi s'il date de plus de 30 jours. */
  async detail(id: number) {
    let car = await this.prisma.car.findUnique({ where: { id } });
    if (!car) throw new NotFound('Carte introuvable');

    const stale = !car.summaryFetchedAt || Date.now() - car.summaryFetchedAt.getTime() > SUMMARY_TTL_MS;
    if (car.wikiTitle && stale) {
      try {
        const summary = await fetchWikiSummary(car.wikiLang ?? 'fr', car.wikiTitle);
        car = await this.prisma.car.update({
          where: { id },
          data: {
            summary: summary.extract ?? car.summary,
            summaryFetchedAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(`Résumé Wikipédia indisponible pour ${car.wikiTitle}: ${(err as Error).message}`);
      }
    }

    return { ...toCardDto(car), summary: car.summary, imageCredit: imageCreditOf(car) };
  }
}
