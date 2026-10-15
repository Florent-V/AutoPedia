<script setup lang="ts">
const player = usePlayerState();
const { remainingMs, progress } = useBoosterTimer();
const { push } = useToasts();

const opening = ref(false);
const openingKey = ref(0);
const result = ref<OpenResult | null>(null);
const error = ref<string | null>(null);

const available = computed(() => player.value?.boosters.available ?? 0);
const max = computed(() => player.value?.boosters.max ?? 10);
const regenMinutes = computed(() => Math.round((player.value?.boosters.regenMs ?? 0) / 60000));

async function open() {
  if (available.value <= 0) return;
  result.value = null;
  error.value = null;
  openingKey.value++;
  opening.value = true;
  try {
    const res = await api<OpenResult>('/boosters/open', { method: 'POST' });
    result.value = res;
    applyBoosterView(res.boosters, res.stats);
    // Les succès s'affichent après la révélation des cartes.
    setTimeout(() => {
      for (const a of res.newAchievements) {
        push({ title: `Succès débloqué : ${a.name}`, message: a.description, icon: a.icon, tier: a.tier }, 7000);
      }
    }, 2500);
  } catch (err) {
    error.value = apiErrorMessage(err, 'Ouverture impossible');
    await refreshPlayer().catch(() => undefined);
  }
}

function close() {
  opening.value = false;
  result.value = null;
  void refreshPlayer().catch(() => undefined);
}
</script>

<template>
  <div class="container page">
    <div class="page-head">
      <div>
        <h1>Boosters</h1>
        <p>Un booster toutes les {{ regenMinutes }} minutes, jusqu’à {{ max }} en réserve.</p>
        <p v-if="player?.pity" class="pity">
          <span title="Garantie : au moins une carte Épique">🔮 Épique garantie dans {{ player.pity.epicIn }} booster{{ player.pity.epicIn > 1 ? 's' : '' }}</span>
          <span title="Garantie : une carte Légendaire">👑 Légendaire garantie dans {{ player.pity.legendaryIn }}</span>
        </p>
      </div>
      <div class="timer panel">
        <div class="timer__count">
          <strong>{{ available }}</strong><span>/{{ max }}</span>
        </div>
        <div class="timer__right">
          <span v-if="remainingMs !== null">Prochain booster dans <strong>{{ formatDuration(remainingMs) }}</strong></span>
          <span v-else>Réserve pleine : ouvrez-en pour relancer le compteur !</span>
          <div class="progress"><span :style="{ width: `${Math.round(progress * 100)}%` }" /></div>
        </div>
      </div>
    </div>

    <InstallCard />

    <section class="stock">
      <button
        v-for="i in max"
        :key="i"
        type="button"
        class="stock__pack"
        :class="{ empty: i > available }"
        :disabled="i > available"
        :aria-label="i <= available ? 'Ouvrir ce booster' : 'Booster en recharge'"
        :style="{ '--i': i }"
        @click="open"
      >
        <BoosterPack :disabled="i > available" />
        <span v-if="i === available + 1 && remainingMs !== null" class="stock__eta">{{ formatDuration(remainingMs) }}</span>
      </button>
    </section>

    <div class="cta">
      <button class="btn btn-primary btn-lg" :disabled="available <= 0" @click="open">
        {{ available > 0 ? 'Ouvrir un booster' : 'Plus de booster disponible' }}
      </button>
    </div>

    <BoosterOpening
      v-if="opening"
      :key="openingKey"
      :result="result"
      :error="error"
      :can-open-another="available > 0"
      @close="close"
      @another="open"
    />
  </div>
</template>

<style scoped>
.pity {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 6px !important;
  font-size: 0.85rem;
}

.timer {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px 20px;
  min-width: min(420px, 100%);
}

.timer__count {
  font-family: var(--font-display);
  font-size: 2.4rem;
  line-height: 1;
}

.timer__count span {
  font-size: 1.2rem;
  color: var(--muted);
}

.timer__right {
  flex: 1;
  display: grid;
  gap: 8px;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.stock {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 22px;
  max-width: 900px;
  margin: 12px auto 0;
}

@media (max-width: 700px) {
  .stock {
    gap: 10px 8px;
  }
  .stock__eta {
    font-size: 0.7rem;
  }
  .cta {
    position: sticky;
    bottom: calc(80px + env(safe-area-inset-bottom));
    margin-top: 24px;
  }
  .cta .btn {
    width: 100%;
  }
  .pity {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 6px !important;
  font-size: 0.85rem;
}

.timer {
    min-width: 0;
    width: 100%;
  }
}

.stock__pack {
  all: unset;
  position: relative;
  cursor: pointer;
  transition: transform 0.2s ease;
  animation: float 4s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.4s);
}

.stock__pack:hover:not(:disabled) {
  transform: translateY(-8px) rotate(-2deg) scale(1.04);
}

.stock__pack:focus-visible {
  outline: 3px solid var(--accent-2);
  outline-offset: 4px;
  border-radius: 8px;
}

.stock__pack.empty {
  cursor: default;
  animation: none;
  opacity: 0.45;
}

.stock__eta {
  position: absolute;
  inset: auto 0 40% 0;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cta {
  display: flex;
  justify-content: center;
  margin-top: 36px;
}

@keyframes float {
  50% {
    transform: translateY(-6px);
  }
}
</style>
