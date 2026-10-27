import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { UserThrottlerGuard } from '../../shared/http/user-throttler.guard';
import { AUTH, createAuth } from './infrastructure/better-auth';
import { AuthGuard } from './http/auth.guard';

@Global()
@Module({
  imports: [
    // Par joueur : 20 requêtes par seconde au plus, 300 par minute.
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 20 },
      { name: 'minute', ttl: 60_000, limit: 300 },
    ]),
  ],
  providers: [
    { provide: AUTH, useFactory: (prisma: PrismaService) => createAuth(prisma), inject: [PrismaService] },
    // Ordre important : l'authentification d'abord, pour limiter le débit par joueur.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
  exports: [AUTH],
})
export class IdentityModule {}
