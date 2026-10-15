<script setup lang="ts">
const player = usePlayerState();
const { remainingMs } = useBoosterTimer();
</script>

<template>
  <NuxtLink v-if="player" to="/boosters" class="chip counter" title="Boosters disponibles">
    <span aria-hidden="true">🎁</span>
    <strong>{{ player.boosters.available }}/{{ player.boosters.max }}</strong>
    <span v-if="remainingMs !== null" class="muted">+1 dans {{ formatDuration(remainingMs) }}</span>
    <span v-else class="muted">réserve pleine</span>
  </NuxtLink>
</template>

<style scoped>
.counter {
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}

/* Sur téléphone, le minuteur détaillé est sur la page Boosters : on garde le compteur compact. */
@media (max-width: 480px) {
  .counter .muted {
    display: none;
  }
}
</style>
