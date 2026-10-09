<script setup lang="ts">
const props = defineProps<{ achievement: Achievement; compact?: boolean }>();
const unlocked = computed(() => !!props.achievement.unlockedAt);
const pct = computed(() =>
  Math.round(((props.achievement.progress ?? 0) / Math.max(1, props.achievement.goal)) * 100),
);
</script>

<template>
  <div class="badge" :class="[achievement.tier, { unlocked, compact }]">
    <div class="badge__medal">
      <span>{{ achievement.icon }}</span>
    </div>
    <div v-if="!compact" class="badge__text">
      <strong>{{ achievement.name }}</strong>
      <small>{{ achievement.description }}</small>
      <div v-if="!unlocked" class="progress" :aria-label="`${pct}%`">
        <span :style="{ width: `${pct}%` }" />
      </div>
      <small v-if="!unlocked" class="muted">{{ achievement.progress ?? 0 }} / {{ achievement.goal }}</small>
      <small v-else class="badge__date">
        Débloqué le {{ new Date(achievement.unlockedAt!).toLocaleDateString('fr-FR') }}
      </small>
    </div>
  </div>
</template>

<style scoped>
.badge {
  --t1: #c47a3a;
  --t2: #7a4a20;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.silver {
  --t1: #e3e8f0;
  --t2: #8892a3;
}
.gold {
  --t1: #ffd56a;
  --t2: #b7790c;
}
.platinum {
  --t1: #b8f3ff;
  --t2: #6a6cff;
}

.badge.compact {
  padding: 0;
  background: none;
  border: none;
}

.badge__medal {
  flex: none;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  font-size: 1.9rem;
  background: radial-gradient(circle at 35% 30%, #fff8, transparent 40%), linear-gradient(145deg, var(--t1), var(--t2));
  box-shadow:
    0 0 0 4px rgba(0, 0, 0, 0.35),
    0 0 0 6px var(--t2);
}

.badge:not(.unlocked) .badge__medal {
  filter: grayscale(1) brightness(0.45);
}

.badge.unlocked.gold .badge__medal,
.badge.unlocked.platinum .badge__medal {
  box-shadow:
    0 0 0 4px rgba(0, 0, 0, 0.35),
    0 0 0 6px var(--t2),
    0 0 22px var(--t1);
}

.badge__text {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.badge__text small {
  color: var(--muted);
}

.badge__date {
  color: var(--success) !important;
}
</style>
