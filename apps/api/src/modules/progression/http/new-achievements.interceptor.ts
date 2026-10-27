import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { AchievementUnlocks } from '../application/achievement-unlocks';

/**
 * Ajoute `newAchievements` (succès débloqués pendant la requête) à la réponse des actions du joueur connecté,
 * quel que soit le contexte qui a déclenché le déblocage.
 */
@Injectable()
export class NewAchievementsInterceptor implements NestInterceptor {
  constructor(private readonly unlocks: AchievementUnlocks) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<{ method: string; user?: { id: string } }>();
    if (req.method === 'GET' || !req.user) return next.handle();
    this.unlocks.open();
    const userId = req.user.id;
    return next.handle().pipe(
      map((body: unknown) => {
        if (!body || typeof body !== 'object' || Array.isArray(body) || 'newAchievements' in body) return body;
        return { ...body, newAchievements: this.unlocks.forUser(userId) };
      }),
    );
  }
}
