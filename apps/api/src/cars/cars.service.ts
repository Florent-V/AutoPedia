import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fetchWikiSummary } from '../catalog/http';
import { imageCreditOf, toCardDto } from './card.dto';

const SUMMARY_TTL_MS = 30 * 24 * 3600 * 1000;

@Injectable()
export class CarsService {
  private readonly logger = new Logger(CarsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async detail(userId: string, id: number) {
    let car = await this.prisma.car.findUnique({ where: { id } });
    if (!car) throw new NotFoundException('Carte introuvable');

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

    const owned = await this.prisma.userCard.findUnique({ where: { userId_carId: { userId, carId: id } } });
    return {
      ...toCardDto(car),
      summary: car.summary,
      imageCredit: imageCreditOf(car),
      quantity: owned?.quantity ?? 0,
      firstObtainedAt: owned?.firstObtainedAt ?? null,
    };
  }
}
