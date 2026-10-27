import type { NextFunction, Request, Response } from 'express';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF en plus des cookies SameSite : une action (POST…) venant d'un navigateur
 * doit provenir du site lui-même. Les clients hors navigateur n'envoient pas d'en-tête Origin.
 */
export function originCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE.has(req.method)) return next();
    const origin = req.headers.origin;
    const site = req.headers['sec-fetch-site'];
    if ((origin && !allowed.has(origin)) || site === 'cross-site') {
      res.status(403).json({ statusCode: 403, message: 'Origine de la requête refusée', error: 'Forbidden' });
      return;
    }
    next();
  };
}
