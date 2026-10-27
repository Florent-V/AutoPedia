import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/**
 * Routes d'administration : en-tête `x-admin-token` comparé en temps constant à ADMIN_TOKEN.
 * Désactivées si ADMIN_TOKEN fait moins de 16 caractères.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const token = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>().headers['x-admin-token'];
    const expected = process.env.ADMIN_TOKEN ?? '';
    const valid =
      expected.length >= 16 &&
      typeof token === 'string' &&
      token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!valid) throw new ForbiddenException();
    return true;
  }
}
