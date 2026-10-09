<script setup lang="ts">
const session = useSessionState();
const player = usePlayerState();
const menuOpen = ref(false);
const route = useRoute();
watch(() => route.fullPath, () => (menuOpen.value = false));

const links = [
  { to: '/boosters', label: 'Boosters' },
  { to: '/collection', label: 'Collection' },
  { to: '/achievements', label: 'Succès' },
  { to: '/profile', label: 'Profil' },
];
</script>

<template>
  <header class="header">
    <div class="container header__inner">
      <NuxtLink to="/" class="logo"><span>Auto</span><span>Pedia</span></NuxtLink>

      <template v-if="session">
        <nav class="nav" :class="{ open: menuOpen }">
          <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="nav__link">{{ l.label }}</NuxtLink>
        </nav>
        <div class="header__right">
          <BoosterCounter />
          <span v-if="player" class="chip points" title="Points de collection">⭐ {{ formatNumber(player.stats.points) }}</span>
          <button class="burger" aria-label="Menu" @click="menuOpen = !menuOpen">☰</button>
        </div>
      </template>
      <div v-else class="header__right">
        <NuxtLink to="/login" class="btn btn-ghost">Connexion</NuxtLink>
        <NuxtLink to="/register" class="btn btn-primary">Jouer</NuxtLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(11, 15, 23, 0.82);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.header__inner {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 64px;
}

.logo {
  font-family: var(--font-display);
  font-size: 1.5rem;
  text-decoration: none;
}

.logo span:last-child {
  color: var(--accent-2);
}

.nav {
  display: flex;
  gap: 4px;
}

.nav__link {
  padding: 8px 14px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--muted);
  font-weight: 600;
}

.nav__link:hover,
.nav__link.router-link-active {
  color: var(--text);
  background: var(--surface-2);
}

.header__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.burger {
  display: none;
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 10px;
  font-size: 1.2rem;
  padding: 4px 10px;
  cursor: pointer;
}

@media (max-width: 860px) {
  .burger {
    display: block;
  }
  .points {
    display: none;
  }
  .nav {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex-direction: column;
    padding: 12px 16px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
  }
  .nav.open {
    display: flex;
  }
}

@media (max-width: 480px) {
  .header__inner {
    gap: 10px;
  }
  .counter .muted {
    display: none;
  }
}
</style>
