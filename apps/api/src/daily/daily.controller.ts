import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { DailyService } from './daily.service';

@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.daily.status(user.id);
  }

  @Post('claim')
  @HttpCode(200)
  claim(@CurrentUser() user: AuthUser) {
    return this.daily.claim(user.id);
  }
}
