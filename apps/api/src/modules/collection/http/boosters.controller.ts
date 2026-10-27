import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../identity/http/auth.guard';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { PlayerStatsQuery } from '../../statistics/player-stats.query';
import { BoostersService } from '../application/boosters.service';

@Controller('boosters')
export class BoostersController {
  constructor(
    private readonly boosters: BoostersService,
    private readonly catalog: CatalogReader,
    private readonly stats: PlayerStatsQuery,
  ) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.boosters.status(user.id);
  }

  /** Aucun paramètre : le contenu du booster est entièrement décidé par le serveur. */
  @Post('open')
  @HttpCode(200)
  async open(@CurrentUser() user: AuthUser) {
    const result = await this.boosters.open(user.id);
    const views = await this.catalog.views(result.cards.map((c) => c.carId));
    return {
      cards: result.cards.map((c) => ({ ...views.get(c.carId)!, quantity: c.quantity, isNew: c.isNew })),
      boosters: result.boosters,
      stats: await this.stats.forUser(user.id),
      pity: result.pity,
    };
  }
}
