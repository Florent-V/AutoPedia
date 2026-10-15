<script setup lang="ts">
const player = usePlayerState();
const badges = ref<Achievement[]>([]);
const wallet = ref<{ balance: number; earned: number; history: Array<{ id: string; label: string; amount: number; createdAt: string }> } | null>(null);

onMounted(async () => {
  await refreshPlayer();
  const res = await api<{ achievements: Achievement[] }>('/achievements');
  badges.value = res.achievements.filter((a) => a.unlockedAt);
  wallet.value = await api('/wallet');
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
    { label: 'Parties jouées', value: s.gamesPlayed ?? 0, icon: '🎮' },
    { label: 'Échanges conclus', value: s.tradesCompleted ?? 0, icon: '🤝' },
    { label: 'Achats en boutique', value: s.shopPurchases ?? 0, icon: '🛒' },
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
      <div class="showcase__head">
        <h2>Vitrine de badges</h2>
        <NuxtLink to="/achievements" class="btn btn-ghost">Tous les succès →</NuxtLink>
      </div>
      <p v-if="!badges.length" class="muted">Aucun badge pour l’instant : ouvrez vos premiers boosters !</p>
      <div class="showcase">
        <div v-for="b in badges" :key="b.id" class="showcase__item" :title="`${b.name} — ${b.description}`">
          <AchievementBadge :achievement="b" compact />
          <small>{{ b.name }}</small>
        </div>
      </div>
    </section>

    <section v-if="wallet" class="panel wallet">
      <div class="showcase__head">
        <h2>Crédits</h2>
        <span class="chip">🪙 {{ formatNumber(wallet.balance) }}</span>
      </div>
      <p class="muted">{{ formatNumber(wallet.earned) }} crédits gagnés au total. Gagnez-en dans les <NuxtLink to="/games">mini-jeux</NuxtLink> ou en vendant à la bourse.</p>
      <ul v-if="wallet.history.length" class="wallet__list">
        <li v-for="h in wallet.history.slice(0, 8)" :key="h.id">
          <span>{{ h.label }}</span>
          <small class="muted">{{ new Date(h.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</small>
          <strong :class="h.amount > 0 ? 'plus' : 'minus'">{{ h.amount > 0 ? '+' : '' }}{{ formatNumber(h.amount) }}</strong>
        </li>
      </ul>
    </section>

    <AppSettings />

    <section class="panel social">
      <h2>Bientôt : amis</h2>
      <p class="muted">
        La bourse d’échanges est ouverte à tous. Prochaine étape : une liste d’amis pour échanger en privé et comparer vos garages.
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

.showcase__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.showcase__head h2 {
  margin: 0;
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

.wallet {
  margin-top: 24px;
}

.wallet__list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.wallet__list li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.plus {
  color: var(--success);
}

.minus {
  color: var(--danger);
}

.social {
  margin-top: 24px;
}
</style>
