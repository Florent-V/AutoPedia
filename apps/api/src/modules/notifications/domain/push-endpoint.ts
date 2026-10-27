import { InvalidRequest } from '../../../shared/domain/errors';

/**
 * Services de notification des navigateurs. Le serveur envoie des requêtes à l'adresse fournie par le client :
 * on la limite à ces services pour qu'elle ne puisse pas viser une machine interne (SSRF).
 */
const PUSH_HOSTS = (process.env.PUSH_ALLOWED_HOSTS ??
  'fcm.googleapis.com,android.googleapis.com,updates.push.services.mozilla.com,.push.apple.com,.notify.windows.com')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function assertPushEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new InvalidRequest('Adresse de notification invalide');
  }
  const host = url.hostname.toLowerCase();
  const allowed = PUSH_HOSTS.some((h) => (h.startsWith('.') ? host.endsWith(h) : host === h));
  if (url.protocol !== 'https:' || url.port !== '' || url.username || !allowed) {
    throw new InvalidRequest('Service de notification non pris en charge');
  }
}
