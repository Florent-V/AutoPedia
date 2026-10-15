import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { Allow } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { GamesService } from './games.service';

class AnswerDto {
  /** « a » / « b » pour le duel, 0 à 3 pour le quiz (validé par le service). */
  @Allow()
  choice: unknown;
}

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.games.overview(user.id);
  }

  @Post(':type/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('type', new ParseEnumPipe(GameType)) type: GameType) {
    return this.games.start(user.id, type);
  }

  @Get('sessions/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.games.get(user.id, id);
  }

  @Post('sessions/:id/answer')
  @HttpCode(200)
  answer(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: AnswerDto) {
    return this.games.answer(user.id, id, body.choice);
  }
}
