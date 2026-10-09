import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.achievements.list(user.id);
  }
}
