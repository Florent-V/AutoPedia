import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH, createAuth } from './auth';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  providers: [
    { provide: AUTH, useFactory: (prisma: PrismaService) => createAuth(prisma), inject: [PrismaService] },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AUTH],
})
export class AuthModule {}
