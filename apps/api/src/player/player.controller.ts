import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { PlayerService } from './player.service';

@Controller('me')
export class PlayerController {
  constructor(private readonly player: PlayerService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.player.me(user);
  }
}
