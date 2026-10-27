import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../../auth/auth.guard';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { DailyRewardService } from '../application/daily-reward.service';

@Controller('daily')
export class DailyController {
  constructor(
    private readonly daily: DailyRewardService,
    private readonly catalog: CatalogReader,
  ) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.daily.status(user.id);
  }

  @Post('claim')
  @HttpCode(200)
  async claim(@CurrentUser() user: AuthUser) {
    const { card, ...result } = await this.daily.claim(user.id);
    const view = card ? await this.catalog.view(card.carId) : null;
    return { ...result, card: view && card ? { ...view, quantity: card.quantity, isNew: card.isNew } : null };
  }
}
