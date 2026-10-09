import type { FetchOptions } from 'ofetch';

/** Appel à l'API NestJS (même origine, cookies de session inclus). */
export async function api<T>(path: string, opts: FetchOptions<'json'> = {}): Promise<T> {
  try {
    return await $fetch<T>(`/api${path}`, { credentials: 'include', ...opts } as never);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401) {
      useSessionState().value = null;
      await navigateTo('/login');
    }
    throw err;
  }
}

export function apiErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  const data = (err as { data?: { message?: string | string[] } }).data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg || fallback;
}
