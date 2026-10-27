import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../identity/http/auth.guard';
import { gameConfig } from '../../../config';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { BoostersService } from '../../collection/application/boosters.service';
import { AchievementsService } from '../../progression/application/achievements.service';
import { PlayerStatsQuery } from '../../statistics/player-stats.query';

/** Profil du joueur connecté : vue composée à partir des différents contextes. */
@Controller('me')
export class MeController {
  constructor(
    private readonly boosters: BoostersService,
    private readonly stats: PlayerStatsQuery,
    private readonly achievements: AchievementsService,
    private readonly catalog: CatalogReader,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const [boosters, stats, catalogSize, achievements, pity] = await Promise.all([
      this.boosters.status(user.id),
      this.stats.forUser(user.id),
      this.catalog.activeCount(),
      this.achievements.count(user.id),
      this.boosters.pityCountdown(user.id),
    ]);
    return {
      user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
      boosters,
      stats: { ...stats, catalogSize, achievements },
      game: { cardsPerBooster: gameConfig.cardsPerBooster },
      pity,
    };
  }
}
