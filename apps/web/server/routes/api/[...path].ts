import { joinURL } from 'ufo';

/** Proxy vers l'API NestJS : le navigateur ne parle qu'à une seule origine (cookies de session first-party). */
export default defineEventHandler((event) => {
  const { apiBase, trustProxy } = useRuntimeConfig(event);
  // IP du joueur transmise à l'API (limitation des tentatives de connexion).
  // On n'utilise X-Forwarded-For que derrière un reverse proxy de confiance, sinon il serait falsifiable.
  const ip = getRequestIP(event, { xForwardedFor: !!trustProxy }) ?? '';
  return proxyRequest(event, joinURL(apiBase, event.path), {
    headers: {
      'x-forwarded-for': ip,
      'x-forwarded-host': getRequestHost(event),
      'x-forwarded-proto': getRequestProtocol(event),
    },
  });
});
