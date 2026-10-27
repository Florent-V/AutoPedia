interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePwa() {
  const canInstall = useState('pwa-can-install', () => false);
  const pushState = useState<'unsupported' | 'disabled' | 'default' | 'granted' | 'denied' | 'subscribed'>(
    'pwa-push',
    () => 'default',
  );

  const isStandalone = computed(
    () =>
      import.meta.client &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true),
  );
  const isIos = computed(() => import.meta.client && /iphone|ipad|ipod/i.test(navigator.userAgent));

  function listenInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      canInstall.value = true;
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      canInstall.value = false;
    });
  }

  async function install() {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    canInstall.value = false;
    return outcome === 'accepted';
  }

  async function refreshPushState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      pushState.value = 'unsupported';
      return;
    }
    const { publicKey } = await api<{ publicKey: string | null }>('/push/public-key');
    if (!publicKey) {
      pushState.value = 'disabled';
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    pushState.value = sub ? 'subscribed' : (Notification.permission as 'default' | 'granted' | 'denied');
  }

  /** Demande l'autorisation et enregistre l'appareil (doit suivre un geste de l'utilisateur). */
  async function enablePush() {
    const { publicKey } = await api<{ publicKey: string | null }>('/push/public-key');
    if (!publicKey) throw new Error('Notifications non configurées sur ce serveur');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      pushState.value = permission === 'denied' ? 'denied' : 'default';
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const { endpoint, keys } = sub.toJSON();
    await api('/push/subscribe', { method: 'POST', body: { endpoint, keys } });
    pushState.value = 'subscribed';
    return true;
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => undefined);
      await sub.unsubscribe();
    }
    pushState.value = 'default';
  }

  return { canInstall, isStandalone, isIos, pushState, listenInstallPrompt, install, refreshPushState, enablePush, disablePush };
}

/** Petite vibration (Android) pour accompagner les révélations. */
export function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}
