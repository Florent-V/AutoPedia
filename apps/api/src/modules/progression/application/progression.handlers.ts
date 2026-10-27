import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../shared/infrastructure/events';
import { BoosterOpened } from '../../collection/domain/events';
import { AchievementsService } from './achievements.service';

/** Les actions des autres contextes font progresser le joueur : succès évalués dans la même transaction. */
@Injectable()
export class ProgressionHandlers {
  constructor(private readonly achievements: AchievementsService) {}

  @OnDomainEvent(BoosterOpened)
  async onBoosterOpened(event: BoosterOpened) {
    await this.achievements.evaluate(event.userId);
  }
}
