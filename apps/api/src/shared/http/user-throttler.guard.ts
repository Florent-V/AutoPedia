import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Limitation de débit par joueur connecté (par adresse IP sinon). S'exécute après le garde d'authentification. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ? `user:${user.id}` : `ip:${String(req.ip)}`;
  }
}
