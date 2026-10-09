import { joinURL } from 'ufo';

/** Proxy vers l'API NestJS : le navigateur ne parle qu'à une seule origine (cookies de session first-party). */
export default defineEventHandler((event) => {
  const { apiBase } = useRuntimeConfig(event);
  return proxyRequest(event, joinURL(apiBase, event.path), {
    headers: { 'x-forwarded-host': getRequestHost(event), 'x-forwarded-proto': getRequestProtocol(event) },
  });
});
