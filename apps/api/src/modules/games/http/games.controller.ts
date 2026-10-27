import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsDefined, IsIn } from 'class-validator';
import { AuthUser, CurrentUser } from '../../../auth/auth.guard';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { GamesService } from '../application/games.service';
import { GAME_TYPES, GameType } from '../domain/game-rules';

class AnswerDto {
  /** « a » / « b » pour les duels, 0 à 3 pour les questions, 0 à 2 pour les portes (le domaine vérifie selon le jeu). */
  @IsDefined() @IsIn(['a', 'b', 0, 1, 2, 3])
  choice: 'a' | 'b' | 0 | 1 | 2 | 3;
}

const GameTypes = Object.fromEntries(GAME_TYPES.map((t) => [t, t])) as Record<GameType, GameType>;

@Controller('games')
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly catalog: CatalogReader,
  ) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.games.overview(user.id);
  }

  @Post(':type/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('type', new ParseEnumPipe(GameTypes)) type: GameType) {
    return this.games.start(user.id, type);
  }

  @Get('sessions/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.games.get(user.id, id);
  }

  @Post('sessions/:id/answer')
  @HttpCode(200)
  async answer(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AnswerDto) {
    const { prize, bonus, doors, finished, ...result } = await this.games.answer(user.id, id, body.choice);
    const views = await this.catalog.views([prize?.carId, bonus?.carId, ...(doors ?? []).map((d) => d.carId)].filter((v): v is number => !!v));
    const card = (won: { carId: number; quantity: number; isNew: boolean } | null) =>
      won && views.has(won.carId) ? { ...views.get(won.carId)!, quantity: won.quantity, isNew: won.isNew } : null;
    const prizeView = card(prize);
    const rewardCard = card(bonus);
    return {
      ...result,
      prize: prizeView,
      // Contenu des trois portes, révélé après le choix.
      doors: doors ? doors.map((d) => ({ tier: d.tier, card: d.carId ? (views.get(d.carId) ?? null) : null })) : null,
      summary: finished ? { score: result.session.score, credits: result.session.credits, rewardCard, prize: prizeView } : null,
    };
  }
}
