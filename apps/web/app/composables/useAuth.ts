import { createAuthClient } from 'better-auth/vue';

let client: ReturnType<typeof createAuthClient> | null = null;

export function useAuthClient() {
  if (!client) client = createAuthClient({ baseURL: window.location.origin, basePath: '/api/auth' });
  return client;
}

/** Session courante (mise en cache dans l'état global). */
export function useSessionState() {
  return useState<{ id: string; name: string; email: string } | null | undefined>('session', () => undefined);
}

export async function loadSession(force = false) {
  const session = useSessionState();
  if (session.value !== undefined && !force) return session.value;
  try {
    const { data } = await useAuthClient().getSession();
    session.value = data?.user ? { id: data.user.id, name: data.user.name, email: data.user.email } : null;
  } catch {
    session.value = null;
  }
  return session.value;
}

export async function signOut() {
  await useAuthClient().signOut();
  useSessionState().value = null;
  usePlayerState().value = null;
  await navigateTo('/login');
}
