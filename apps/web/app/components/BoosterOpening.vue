<script setup lang="ts">
const props = defineProps<{
  result: OpenResult | null;
  error: string | null;
  canOpenAnother: boolean;
}>();
const emit = defineEmits<{ close: []; another: [] }>();

type Phase = 'pack' | 'tearing' | 'cards';
const phase = ref<Phase>('pack');
const isMobile = ref(false);
const deckDone = ref(false);
const torn = ref(false);
const flipped = ref<boolean[]>([]);

const cards = computed(() => props.result?.cards ?? []);
const allFlipped = computed(() => cards.value.length > 0 && flipped.value.every(Boolean));
const newCount = computed(() => cards.value.filter((c) => c.isNew).length);
const gained = computed(() => cards.value.filter((c) => c.isNew).reduce((s, c) => s + c.points, 0));
const best = computed(() =>
  cards.value.reduce<Card | null>(
    (b, c) => (!b || RARITY_ORDER.indexOf(c.rarity) > RARITY_ORDER.indexOf(b.rarity) ? c : b),
    null,
  ),
);

function tear() {
  if (phase.value !== 'pack') return;
  torn.value = true;
  phase.value = 'tearing';
}

// Passe aux cartes dès que l'animation est finie ET que le serveur a répondu.
watch(
  () => [phase.value, props.result] as const,
  ([p, r]) => {
    if (p === 'tearing' && r) {
      setTimeout(() => {
        flipped.value = r.cards.map(() => false);
        phase.value = 'cards';
      }, 650);
    }
  },
  { immediate: true },
);

function flip(i: number) {
  flipped.value[i] = true;
}

function finishDeck() {
  flipped.value = cards.value.map(() => true);
  deckDone.value = true;
}

function flipAll() {
  cards.value.forEach((_, i) => setTimeout(() => flip(i), i * 180));
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && (allFlipped.value || props.error)) emit('close');
  if ((e.key === 'Enter' || e.key === ' ') && phase.value === 'pack') {
    e.preventDefault();
    tear();
  }
}

onMounted(() => {
  isMobile.value = window.matchMedia('(max-width: 700px)').matches;
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="opening" role="dialog" aria-modal="true" aria-label="Ouverture du booster">
    <div class="opening__raysbox" aria-hidden="true">
      <div class="opening__rays" :class="best && allFlipped ? `rays-${best.rarity.toLowerCase()}` : ''" />
    </div>

    <div v-if="error" class="opening__center">
      <p class="error">{{ error }}</p>
      <button class="btn" @click="emit('close')">Fermer</button>
    </div>

    <div v-else-if="phase !== 'cards'" class="opening__center">
      <button type="button" class="opening__pack" :class="{ shake: phase === 'pack' }" @click="tear">
        <BoosterPack :tearing="torn" />
      </button>
      <p class="opening__hint">{{ phase === 'pack' ? `${isMobile ? 'Touchez' : 'Cliquez'} pour déchirer le booster` : 'Ouverture…' }}</p>
    </div>

    <div v-else-if="isMobile && !deckDone" class="opening__cards">
      <MobileReveal :cards="cards" @done="finishDeck" />
      <div class="opening__actions">
        <button class="btn btn-ghost" @click="finishDeck">Tout révéler</button>
      </div>
    </div>

    <div v-else class="opening__cards">
      <div class="opening__row" :class="{ recap: isMobile }">
        <div
          v-for="(card, i) in cards"
          :key="`${card.id}-${i}`"
          class="opening__slot"
          :style="{ animationDelay: `${i * 90}ms` }"
        >
          <FlipCard :card="card" :flipped="!!flipped[i]" @flip="flip(i)" />
        </div>
      </div>

      <div class="opening__actions">
        <template v-if="!allFlipped">
          <p class="opening__hint">Cliquez sur les cartes pour les révéler</p>
          <button class="btn" @click="flipAll">Tout révéler</button>
        </template>
        <template v-else>
          <p class="opening__summary">
            <strong>{{ newCount }}</strong> nouvelle{{ newCount > 1 ? 's' : '' }} carte{{ newCount > 1 ? 's' : '' }}
            <span v-if="gained"> · +{{ gained }} points</span>
          </p>
          <div class="opening__buttons">
            <button v-if="canOpenAnother" class="btn btn-primary" @click="emit('another')">Ouvrir un autre booster</button>
            <NuxtLink class="btn" to="/collection" @click="emit('close')">Voir ma collection</NuxtLink>
            <button class="btn btn-ghost" @click="emit('close')">Fermer</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opening {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  overflow-x: hidden;
  overflow-y: auto;
  padding: calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
  overscroll-behavior: contain;
  background: radial-gradient(circle at 50% 40%, rgba(30, 20, 40, 0.92), rgba(5, 7, 12, 0.97));
  backdrop-filter: blur(6px);
  animation: fade-in 0.25s ease;
}

.opening__raysbox {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.opening__rays {
  position: absolute;
  inset: -50%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.8s ease;
  background: repeating-conic-gradient(from 0deg, var(--ray, transparent) 0deg 6deg, transparent 6deg 18deg);
  animation: spin 40s linear infinite;
  mask: radial-gradient(circle, #000 0%, transparent 55%);
}

.rays-rare {
  --ray: rgba(59, 156, 255, 0.12);
  opacity: 1;
}
.rays-epic {
  --ray: rgba(181, 92, 255, 0.18);
  opacity: 1;
}
.rays-legendary {
  --ray: rgba(255, 194, 61, 0.25);
  opacity: 1;
}

.opening__center {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 20px;
}

.opening__pack {
  all: unset;
  width: min(280px, 62vw);
  cursor: pointer;
}

.opening__pack:focus-visible {
  outline: 3px solid var(--accent-2);
  outline-offset: 6px;
}

.shake {
  animation: shake 2.4s ease-in-out infinite;
}

.opening__hint {
  color: var(--muted);
  margin: 0;
  text-align: center;
}

.opening__cards {
  position: relative;
  width: 100%;
  max-width: 1200px;
  display: grid;
  gap: 28px;
}

.opening__row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  align-items: center;
}

@media (max-width: 900px) {
  .opening__row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .opening__row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .opening__row.recap {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
}

.opening__slot {
  animation: deal 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}

.opening__actions {
  display: grid;
  justify-items: center;
  gap: 14px;
  text-align: center;
}

.opening__summary {
  margin: 0;
  font-size: 1.15rem;
}

.opening__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

@keyframes deal {
  from {
    opacity: 0;
    transform: translateY(80px) scale(0.6) rotate(-8deg);
  }
}

@keyframes shake {
  0%,
  70%,
  100% {
    transform: rotate(0);
  }
  75% {
    transform: rotate(-3deg) scale(1.02);
  }
  80% {
    transform: rotate(3deg) scale(1.02);
  }
  85% {
    transform: rotate(-2deg);
  }
  90% {
    transform: rotate(2deg);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
