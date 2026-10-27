import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../identity/http/auth.guard';
import { AchievementsService } from '../application/achievements.service';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.achievements.list(user.id);
  }
}
