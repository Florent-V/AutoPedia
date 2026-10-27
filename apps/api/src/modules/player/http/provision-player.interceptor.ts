import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, switchMap } from 'rxjs';
import { PlayerProvisioning } from '../application/player-provisioning';

/** Garantit que le joueur connecté a sa fiche avant d'atteindre un contrôleur. */
@Injectable()
export class ProvisionPlayerInterceptor implements NestInterceptor {
  constructor(private readonly provisioning: PlayerProvisioning) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const user = context.switchToHttp().getRequest<{ user?: { id: string } }>().user;
    if (!user) return next.handle();
    return from(this.provisioning.ensure(user.id)).pipe(switchMap(() => next.handle()));
  }
}
