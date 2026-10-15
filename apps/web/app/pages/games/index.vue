<script setup lang="ts">
interface GameInfo {
  type: 'DUEL' | 'QUIZ';
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

const icons: Record<string, string> = { DUEL: '⚔️', QUIZ: '🧠' };

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
        <p>Gagnez des crédits à dépenser au marché. Un sans-faute rapporte une carte bonus !</p>
      </div>
      <span v-if="data" class="chip">Nouvelles parties dans {{ formatDuration(new Date(data.resetsAt).getTime() - now) }}</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="games">
      <article v-for="g in data?.games ?? []" :key="g.type" class="panel game" :class="g.type.toLowerCase()">
        <div class="game__icon">{{ icons[g.type] }}</div>
        <h2>{{ g.name }}</h2>
        <p class="muted">{{ g.description }}</p>
        <ul class="game__facts">
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
  </div>
</template>

<style scoped>
.games {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
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
