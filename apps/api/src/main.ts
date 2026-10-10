import './env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { AUTH, Auth } from './auth/auth';
import { MEDIA_DIR } from './catalog/media.service';

async function bootstrap() {
  // Le corps des requêtes Better Auth doit rester brut : on active le parseur JSON après le montage du handler.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const auth = app.get<Auth>(AUTH);
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json', { limit: '100kb' });

  // Photos des cartes stockées localement (noms de fichiers versionnés : cache long).
  mkdirSync(MEDIA_DIR, { recursive: true });
  app.use(
    '/api/media',
    express.static(MEDIA_DIR, { immutable: true, maxAge: '365d', index: false, dotfiles: 'deny', fallthrough: false }),
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API Garage démarrée sur le port ${port}`, 'Bootstrap');
}

void bootstrap();
