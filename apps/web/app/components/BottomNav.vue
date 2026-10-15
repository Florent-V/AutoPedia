<script setup lang="ts">
const player = usePlayerState();

const tabs = [
  { to: '/boosters', label: 'Boosters', icon: 'M4 8h16v12H4z M8 8V5h8v3 M4 12h16' },
  { to: '/collection', label: 'Collection', icon: 'M5 4h10v14H5z M9 7h10v14H9' },
  { to: '/games', label: 'Jeux', icon: 'M6 9h12a3 3 0 0 1 3 3v3a2 2 0 0 1-3.5 1.3L15 14H9l-2.5 2.3A2 2 0 0 1 3 15v-3a3 3 0 0 1 3-3z M8 11v2 M7 12h2 M15.5 12h.01 M17.5 12h.01' },
  { to: '/market', label: 'Marché', icon: 'M4 9l1.5-5h13L20 9 M4 9h16v2a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0z M5 13v7h14v-7 M10 20v-4h4v4' },
  { to: '/profile', label: 'Profil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1-4 4-6 8-6s7 2 8 6' },
];
</script>

<template>
  <nav class="bottom-nav" aria-label="Navigation principale">
    <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="bottom-nav__tab">
      <span class="bottom-nav__icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="t.icon" /></svg>
        <span v-if="t.to === '/boosters' && player && player.boosters.available > 0" class="bottom-nav__badge">
          {{ player.boosters.available }}
        </span>
      </span>
      <span>{{ t.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: none;
}

@media (max-width: 860px) {
  .bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: rgba(11, 15, 23, 0.92);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
  }
}

.bottom-nav__tab {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 6px 0;
  border-radius: 12px;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.72rem;
  font-weight: 600;
}

.bottom-nav__tab.router-link-active {
  color: var(--text);
}

.bottom-nav__tab.router-link-active .bottom-nav__icon {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent-2);
}

.bottom-nav__icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 30px;
  border-radius: 999px;
  transition: background 0.2s ease;
}

.bottom-nav__icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bottom-nav__badge {
  position: absolute;
  top: -2px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.68rem;
  line-height: 18px;
  text-align: center;
}
</style>
