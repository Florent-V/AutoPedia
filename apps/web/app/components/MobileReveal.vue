<script setup lang="ts">
/** Révélation carte par carte, pensée pour le tactile : toucher pour retourner, glisser pour passer. */
const props = defineProps<{ cards: Card[] }>();
const emit = defineEmits<{ done: [] }>();

const index = ref(0);
const flipped = ref(false);
const leaving = ref(false);
const dragX = ref(0);
let startX: number | null = null;

const current = computed(() => props.cards[index.value]);
const remaining = computed(() => props.cards.length - index.value - 1);

function vibrateFor(card: Card) {
  if (card.rarity === 'LEGENDARY') haptic([40, 60, 40, 60, 120]);
  else if (card.rarity === 'EPIC') haptic([30, 50, 60]);
  else if (card.rarity === 'RARE') haptic(30);
}

function next() {
  if (!flipped.value || leaving.value) return;
  leaving.value = true;
  setTimeout(() => {
    leaving.value = false;
    dragX.value = 0;
    if (index.value >= props.cards.length - 1) {
      emit('done');
      return;
    }
    index.value++;
    flipped.value = false;
  }, 260);
}

function tap() {
  if (!current.value) return;
  if (!flipped.value) {
    flipped.value = true;
    vibrateFor(current.value);
  } else {
    next();
  }
}

function onDown(e: PointerEvent) {
  if (flipped.value) startX = e.clientX;
}
function onMove(e: PointerEvent) {
  if (startX !== null) dragX.value = Math.min(0, e.clientX - startX);
}
function onUp() {
  if (startX === null) return;
  const moved = dragX.value;
  startX = null;
  if (moved < -60) next();
  else dragX.value = 0;
}

const cardStyle = computed(() => ({
  transform: leaving.value
    ? 'translateX(-130%) rotate(-14deg)'
    : `translateX(${dragX.value}px) rotate(${dragX.value / 20}deg)`,
  transition: startX !== null ? 'none' : 'transform 0.26s ease',
}));
</script>

<template>
  <div class="reveal">
    <div class="reveal__stage">
      <div v-for="n in Math.min(remaining, 3)" :key="n" class="reveal__under" :style="{ '--n': n }">
        <CardBack />
      </div>
      <div
        v-if="current"
        :key="index"
        class="reveal__current"
        :style="cardStyle"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <FlipCard :card="current" :flipped="flipped" @flip="tap" />
        <button v-if="flipped" class="reveal__hit" aria-label="Carte suivante" @click="tap" />
      </div>
    </div>

    <div class="reveal__dots" aria-hidden="true">
      <span
        v-for="(c, i) in cards"
        :key="i"
        :class="[{ on: i < index || (i === index && flipped) }, i <= index ? `r-${c.rarity.toLowerCase()}` : '']"
      />
    </div>
    <p class="reveal__hint">
      {{ !flipped ? 'Touchez la carte pour la retourner' : index < cards.length - 1 ? 'Glissez ou touchez pour la suivante' : 'Touchez pour voir le récapitulatif' }}
    </p>
  </div>
</template>

<style scoped>
.reveal {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: 18px;
}

.reveal__stage {
  position: relative;
  width: min(78vw, 340px, calc((100dvh - 230px) * 63 / 88));
  aspect-ratio: 63 / 88;
}

.reveal__under,
.reveal__current {
  position: absolute;
  inset: 0;
}

.reveal__under {
  transform: translate(calc(var(--n) * 6px), calc(var(--n) * -6px)) rotate(calc(var(--n) * 2deg));
  opacity: calc(1 - var(--n) * 0.25);
  z-index: calc(10 - var(--n));
}

.reveal__current {
  z-index: 20;
  touch-action: pan-y;
  animation: pop 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

.reveal__hit {
  all: unset;
  position: absolute;
  inset: 0;
  cursor: pointer;
}

.reveal__dots {
  display: flex;
  gap: 8px;
}

.reveal__dots span {
  --c: var(--muted);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.reveal__dots span.on {
  background: var(--c);
  box-shadow: 0 0 8px var(--c);
}

.r-common {
  --c: var(--r-common) !important;
}
.r-uncommon {
  --c: var(--r-uncommon) !important;
}
.r-rare {
  --c: var(--r-rare) !important;
}
.r-epic {
  --c: var(--r-epic) !important;
}
.r-legendary {
  --c: var(--r-legendary) !important;
}

.reveal__hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

@keyframes pop {
  from {
    transform: scale(0.85) translateY(20px);
    opacity: 0;
  }
}
</style>
