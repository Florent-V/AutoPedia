<script setup lang="ts">
const player = usePlayerState();
const badges = ref<Achievement[]>([]);

onMounted(async () => {
  await refreshPlayer();
  const res = await api<{ achievements: Achievement[] }>('/achievements');
  badges.value = res.achievements.filter((a) => a.unlockedAt);
});

const stats = computed(() => {
  const s = player.value?.stats;
  if (!s) return [];
  return [
    { label: 'Points de collection', value: s.points, icon: '⭐' },
    { label: 'Cartes différentes', value: s.uniqueCards, icon: '🎴' },
    { label: 'Cartes obtenues', value: s.cardsObtained, icon: '📦' },
    { label: 'Légendaires', value: s.legendary, icon: '👑' },
    { label: 'Épiques', value: s.epic, icon: '🔮' },
    { label: 'Voitures de course', value: s.racing ?? 0, icon: '🏁' },
    { label: 'Pays représentés', value: s.countries, icon: '🌍' },
    { label: 'Décennies couvertes', value: s.decades, icon: '⏳' },
    { label: 'Boosters ouverts', value: s.boostersOpened, icon: '🎁' },
  ];
});
</script>

<template>
  <div v-if="player" class="container page">
    <div class="page-head">
      <div class="identity">
        <div class="avatar">{{ player.user.name.slice(0, 1).toUpperCase() }}</div>
        <div>
          <h1>{{ player.user.name }}</h1>
          <p>{{ player.user.email }}</p>
        </div>
      </div>
      <button class="btn" @click="signOut">Se déconnecter</button>
    </div>

    <section class="stats">
      <div v-for="s in stats" :key="s.label" class="panel stat">
        <span class="stat__icon">{{ s.icon }}</span>
        <strong>{{ formatNumber(s.value) }}</strong>
        <span class="muted">{{ s.label }}</span>
      </div>
    </section>

    <section class="panel">
      <h2>Vitrine de badges</h2>
      <p v-if="!badges.length" class="muted">Aucun badge pour l’instant : ouvrez vos premiers boosters !</p>
      <div class="showcase">
        <div v-for="b in badges" :key="b.id" class="showcase__item" :title="`${b.name} — ${b.description}`">
          <AchievementBadge :achievement="b" compact />
          <small>{{ b.name }}</small>
        </div>
      </div>
    </section>

    <AppSettings />

    <section class="panel social">
      <h2>Bientôt : amis & échanges</h2>
      <p class="muted">
        Ajoutez vos amis et échangez vos doublons pour compléter votre collection. Le mode solo d’abord, le garage partagé ensuite !
      </p>
    </section>
  </div>
</template>

<style scoped>
.identity {
  display: flex;
  align-items: center;
  gap: 16px;
}

.identity h1 {
  margin: 0;
}

.avatar {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  font: 1.8rem var(--font-display);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

@media (max-width: 600px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .stat {
    padding: 12px;
  }
  .stat strong {
    font-size: 1.4rem;
  }
  .stat .muted {
    font-size: 0.8rem;
  }
}

.stat {
  display: grid;
  gap: 4px;
  padding: 16px;
}

.stat strong {
  font: 1.8rem var(--font-display);
}

.stat__icon {
  font-size: 1.4rem;
}

.showcase {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.showcase__item {
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 92px;
  text-align: center;
}

.showcase__item small {
  color: var(--muted);
  font-size: 0.75rem;
}

.social {
  margin-top: 24px;
}
</style>
