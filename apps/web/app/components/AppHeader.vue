<script setup lang="ts">
const session = useSessionState();
const player = usePlayerState();

const links = [
  { to: '/boosters', label: 'Boosters' },
  { to: '/collection', label: 'Collection' },
  { to: '/games', label: 'Jeux' },
  { to: '/market', label: 'Marché' },
  { to: '/achievements', label: 'Succès' },
  { to: '/profile', label: 'Profil' },
];
</script>

<template>
  <header class="header">
    <div class="container header__inner">
      <NuxtLink to="/" class="brand"><AppLogo /></NuxtLink>

      <template v-if="session">
        <nav class="nav">
          <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="nav__link">{{ l.label }}</NuxtLink>
        </nav>
        <div class="header__right">
          <BoosterCounter />
          <NuxtLink v-if="player" to="/market" class="chip credits" title="Crédits">🪙 {{ formatNumber(player.stats.credits ?? 0) }}</NuxtLink>
          <span v-if="player" class="chip points" title="Points de collection">⭐ {{ formatNumber(player.stats.points) }}</span>
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
  padding-top: env(safe-area-inset-top);
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

.brand {
  font-size: 1.45rem;
  text-decoration: none;
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

.credits {
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1100px) {
  .points {
    display: none;
  }
}

.header__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 860px) {
  .nav {
    display: none;
  }
}

@media (max-width: 480px) {
  .header__inner {
    gap: 10px;
  }
  .counter .muted {
    display: none;
  }
  .brand {
    font-size: 1.25rem;
  }
  .points {
    display: none;
  }
}
</style>
