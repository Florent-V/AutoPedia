import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { AUTH, Auth } from './modules/identity/infrastructure/better-auth';
import { MEDIA_DIR } from './modules/catalog/application/media-sync.service';
import { DomainErrorFilter } from './shared/http/domain-error.filter';
import { originCheck } from './shared/http/origin-check';

/** Configuration HTTP commune au serveur et aux tests de bout en bout. */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // En-têtes de sécurité. L'API ne sert que du JSON et des images : politique de contenu la plus stricte.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean);
  // Actions des joueurs : uniquement depuis le site (Better Auth applique sa propre vérification sur /api/auth).
  app.use('/api', (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.path.startsWith('/auth/') ? next() : originCheck(origins)(req, res, next),
  );

  // Le corps des requêtes Better Auth doit rester brut : on active le parseur JSON après le montage du handler.
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
  // Toute donnée non prévue dans un DTO est refusée (400) : le client ne peut rien glisser de plus dans une requête.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
    }),
  );
  app.useGlobalFilters(new DomainErrorFilter());
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.enableShutdownHooks();
  return app;
}
