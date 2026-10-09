export function usePlayerState() {
  return useState<Me | null>('player', () => null);
}

/** Décalage entre l'horloge du serveur et celle du navigateur. */
function useClockOffset() {
  return useState<number>('clock-offset', () => 0);
}

export async function refreshPlayer() {
  const me = await api<Me>('/me');
  usePlayerState().value = me;
  useClockOffset().value = new Date(me.boosters.serverTime).getTime() - Date.now();
  return me;
}

export function applyBoosterView(view: BoosterView, stats?: Stats) {
  const player = usePlayerState();
  if (!player.value) return;
  player.value = {
    ...player.value,
    boosters: view,
    stats: stats ? { ...player.value.stats, ...stats } : player.value.stats,
  };
  useClockOffset().value = new Date(view.serverTime).getTime() - Date.now();
}

let refreshing = false;

/** Compte à rebours vers le prochain booster, mis à jour chaque seconde. */
export function useBoosterTimer() {
  const player = usePlayerState();
  const offset = useClockOffset();
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;

  onMounted(() => {
    timer = setInterval(async () => {
      now.value = Date.now();
      const next = player.value?.boosters.nextAt;
      if (next && !refreshing && new Date(next).getTime() <= now.value + offset.value) {
        refreshing = true;
        try {
          await refreshPlayer();
        } finally {
          refreshing = false;
        }
      }
    }, 1000);
  });
  onBeforeUnmount(() => clearInterval(timer));

  const remainingMs = computed(() => {
    const next = player.value?.boosters.nextAt;
    if (!next) return null;
    return Math.max(0, new Date(next).getTime() - (now.value + offset.value));
  });

  const progress = computed(() => {
    const b = player.value?.boosters;
    if (!b || remainingMs.value === null) return 1;
    return 1 - remainingMs.value / b.regenMs;
  });

  return { remainingMs, progress };
}
