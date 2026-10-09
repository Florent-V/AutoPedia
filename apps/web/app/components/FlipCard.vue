<script setup lang="ts">
defineProps<{ card: Card; flipped: boolean }>();
defineEmits<{ flip: [] }>();
</script>

<template>
  <button
    type="button"
    class="flip"
    :class="{ flipped }"
    :aria-label="flipped ? card.name : 'Retourner la carte'"
    @click="$emit('flip')"
  >
    <div class="flip__inner">
      <div class="flip__face flip__back">
        <CardBack :glow="['RARE', 'EPIC', 'LEGENDARY'].includes(card.rarity) ? card.rarity : null" />
      </div>
      <div class="flip__face flip__front">
        <CarCard :card="card" :interactive="flipped" size="lg" />
      </div>
    </div>
  </button>
</template>

<style scoped>
.flip {
  all: unset;
  display: block;
  width: 100%;
  aspect-ratio: 63 / 88;
  perspective: 1200px;
  cursor: pointer;
}

.flip:focus-visible {
  outline: 3px solid var(--accent-2);
  outline-offset: 4px;
  border-radius: 12px;
}

.flip__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.flipped .flip__inner {
  transform: rotateY(180deg);
}

.flipped {
  cursor: default;
}

.flip__face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip__front {
  transform: rotateY(180deg);
}

.flip__front :deep(.car-card) {
  max-width: none;
}
</style>
