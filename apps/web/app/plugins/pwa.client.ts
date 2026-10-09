export default defineNuxtPlugin(() => {
  // En développement, le service worker gênerait le rechargement à chaud.
  if (import.meta.dev || !('serviceWorker' in navigator)) return;
  usePwa().listenInstallPrompt();
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
});
