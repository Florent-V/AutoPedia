import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { BoostersService } from './boosters.service';

@Controller('boosters')
export class BoostersController {
  constructor(private readonly boosters: BoostersService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.boosters.status(user.id);
  }

  @Post('open')
  @HttpCode(200)
  open(@CurrentUser() user: AuthUser) {
    return this.boosters.open(user.id);
  }
}
