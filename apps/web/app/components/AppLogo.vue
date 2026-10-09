<script setup lang="ts">
withDefaults(defineProps<{ showText?: boolean }>(), { showText: true });
const gid = `logo-g-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <span class="logo">
    <svg class="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff3d3d" />
          <stop offset="1" stop-color="#ffb020" />
        </linearGradient>
      </defs>
      <path d="M6 27 L32 9 L58 27" fill="none" :stroke="`url(#${gid})`" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="14" y="30" width="36" height="5" rx="2" :fill="`url(#${gid})`" />
      <rect x="14" y="38" width="36" height="5" rx="2" :fill="`url(#${gid})`" opacity=".8" />
      <rect x="14" y="46" width="36" height="5" rx="2" :fill="`url(#${gid})`" opacity=".6" />
      <rect x="14" y="54" width="36" height="5" rx="2" :fill="`url(#${gid})`" opacity=".4" />
    </svg>
    <span v-if="showText" class="logo__text">Garage</span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
}

.logo__mark {
  width: 1.25em;
  height: 1.25em;
  flex: none;
}

.logo__text {
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}
</style>
