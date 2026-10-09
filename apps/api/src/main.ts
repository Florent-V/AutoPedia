import './env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { AUTH, Auth } from './auth/auth';

async function bootstrap() {
  // Le corps des requêtes Better Auth doit rester brut : on active le parseur JSON après le montage du handler.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const auth = app.get<Auth>(AUTH);
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json', { limit: '100kb' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API AutoPedia démarrée sur le port ${port}`, 'Bootstrap');
}

void bootstrap();
