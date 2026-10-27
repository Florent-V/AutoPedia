import './env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API Garage démarrée sur le port ${port}`, 'Bootstrap');
}

void bootstrap();
