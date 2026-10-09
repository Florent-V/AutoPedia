const PUBLIC = new Set(['/', '/login', '/register']);

export default defineNuxtRouteMiddleware(async (to) => {
  const user = await loadSession();
  if (!user && !PUBLIC.has(to.path)) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
  if (user && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/boosters');
  }
  if (user && !usePlayerState().value) {
    await refreshPlayer().catch(() => undefined);
  }
});
