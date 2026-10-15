<script setup lang="ts">
interface GameInfo {
  type: 'DUEL' | 'QUIZ' | 'WEIGHT' | 'MYSTERY' | 'DOORS';
  reward: 'credits' | 'card';
  name: string;
  description: string;
  rounds: number;
  creditsPerWin: number;
  playsPerDay: number;
  playsLeft: number;
  active: string | null;
  bestScore: number;
}

const data = ref<{ resetsAt: string; games: GameInfo[] } | null>(null);
const error = ref<string | null>(null);
const starting = ref<string | null>(null);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const icons: Record<string, string> = { DUEL: '⚔️', QUIZ: '🧠', WEIGHT: '⚖️', MYSTERY: '🃏', DOORS: '🚪' };

const facts: Record<string, string[]> = {
  WEIGHT: ['🎴 Bonne réponse = la plus lourde est à vous', '⚡ Une seule question, réponse immédiate'],
  MYSTERY: ['🎴 Bonne réponse = la carte est à vous', '📈 Commune : le pays · Rare : la décennie · Épique / Légendaire : l’année exacte'],
  DOORS: ['🎴 Une carte standard derrière une porte', '👑 Une Épique ou une Légendaire derrière une autre', '💨 Rien derrière la dernière…'],
};

const cardGames = computed(() => data.value?.games.filter((g) => g.reward === 'card') ?? []);
const creditGames = computed(() => data.value?.games.filter((g) => g.reward === 'credits') ?? []);

onMounted(async () => {
  timer = setInterval(() => (now.value = Date.now()), 1000);
  data.value = await api('/games');
});
onBeforeUnmount(() => clearInterval(timer));

async function play(game: GameInfo) {
  error.value = null;
  starting.value = game.type;
  try {
    const session = await api<{ id: string }>(`/games/${game.type}/start`, { method: 'POST' });
    await navigateTo(`/games/${session.id}`);
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    starting.value = null;
  }
}
</script>

<template>
  <div class="container page">
    <div class="page-head">
      <div>
        <h1>Mini-jeux</h1>
        <p>Gagnez des cartes en un instant, ou des crédits à dépenser au marché.</p>
      </div>
      <span v-if="data" class="chip">Nouvelles parties dans {{ formatDuration(new Date(data.resetsAt).getTime() - now) }}</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-for="section in [
      { title: 'Jeux rapides · une carte à gagner', list: cardGames },
      { title: 'Jeux à crédits', list: creditGames },
    ]" :key="section.title">
    <h2 v-if="section.list.length" class="section-title">{{ section.title }}</h2>
    <section class="games">
      <article v-for="g in section.list" :key="g.type" class="panel game" :class="g.type.toLowerCase()">
        <div class="game__icon">{{ icons[g.type] }}</div>
        <h2>{{ g.name }}</h2>
        <p class="muted">{{ g.description }}</p>
        <ul v-if="g.reward === 'card'" class="game__facts">
          <li v-for="f in facts[g.type]" :key="f">{{ f }}</li>
        </ul>
        <ul v-else class="game__facts">
          <li>🪙 {{ g.creditsPerWin }} crédits par bonne réponse</li>
          <li>🎴 Carte bonus pour un {{ g.rounds }}/{{ g.rounds }}</li>
          <li>🏆 Meilleur score : {{ g.bestScore }}/{{ g.rounds }}</li>
        </ul>
        <div class="game__plays">
          <span v-for="i in g.playsPerDay" :key="i" class="dot" :class="{ used: i > g.playsLeft }" />
          <small class="muted">{{ g.playsLeft }} partie{{ g.playsLeft > 1 ? 's' : '' }} restante{{ g.playsLeft > 1 ? 's' : '' }} aujourd’hui</small>
        </div>
        <button class="btn btn-primary btn-lg" :disabled="(!g.playsLeft && !g.active) || starting === g.type" @click="play(g)">
          {{ g.active ? 'Reprendre la partie' : g.playsLeft ? 'Jouer' : 'Revenez demain' }}
        </button>
      </article>
    </section>
    </template>
  </div>
</template>

<style scoped>
.games {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
}

.section-title {
  font-size: 1.15rem;
  margin: 26px 0 12px;
  color: var(--muted);
}

.section-title:first-of-type {
  margin-top: 0;
}

.game {
  display: grid;
  gap: 12px;
  align-content: start;
  position: relative;
  overflow: hidden;
}

.game::before {
  content: '';
  position: absolute;
  inset: -40% -40% auto auto;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow), transparent 70%);
  opacity: 0.35;
  pointer-events: none;
}

.duel {
  --glow: var(--accent);
}
.quiz {
  --glow: var(--r-rare);
}
.weight {
  --glow: var(--r-uncommon);
}
.mystery {
  --glow: var(--r-epic);
}
.doors {
  --glow: var(--r-legendary);
}

.game__icon {
  font-size: 2.6rem;
}

.game h2,
.game p {
  margin: 0;
}

.game__facts {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
  font-size: 0.92rem;
}

.game__plays {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.dot.used {
  background: var(--surface-2);
  box-shadow: none;
  border: 1px solid var(--border);
}

.game__plays small {
  margin-left: 6px;
}
</style>
