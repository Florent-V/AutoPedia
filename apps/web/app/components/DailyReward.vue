<script setup lang="ts">
interface Reward {
  day: number;
  credits: number;
  boosters: number;
  topCard: boolean;
  label: string;
}
interface Status {
  canClaim: boolean;
  streak: number;
  bestStreak: number;
  day: number;
  resetsAt: string;
  rewards: Reward[];
}

const status = ref<Status | null>(null);
const busy = ref(false);
const won = ref<Card | null>(null);
const { push } = useToasts();

const icon = (r: Reward) => (r.topCard ? '👑' : r.boosters ? '🎁' : '🪙');
const short = (r: Reward) => (r.topCard ? 'Épique' : r.boosters ? `×${r.boosters}` : `${r.credits}`);

onMounted(async () => {
  status.value = await api<Status>('/daily').catch(() => null);
});

async function claim() {
  busy.value = true;
  try {
    const res = await api<{ reward: Reward; streak: number; card: Card | null; balance: number; boosters: BoosterView; newAchievements: Achievement[] }>(
      '/daily/claim',
      { method: 'POST' },
    );
    haptic([30, 40, 30]);
    push({ title: `Jour ${res.reward.day} : ${res.reward.label}`, message: `Série de ${res.streak} jour${res.streak > 1 ? 's' : ''} 🔥`, icon: icon(res.reward) });
    won.value = res.card;
    notifyAchievements(res.newAchievements, 800);
    await refreshPlayer();
    status.value = await api<Status>('/daily');
  } catch (err) {
    push({ title: 'Récompense indisponible', message: apiErrorMessage(err), icon: '⚠️' });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section v-if="status" class="daily panel" :class="{ ready: status.canClaim }">
    <div class="daily__head">
      <div>
        <strong>{{ status.canClaim ? '🎁 Récompense du jour disponible !' : 'Récompense du jour récupérée ✓' }}</strong>
        <small class="muted">
          Série : {{ status.streak }} jour{{ status.streak > 1 ? 's' : '' }} 🔥 · revenez chaque jour, la série repart à zéro si vous manquez un jour
        </small>
      </div>
      <button v-if="status.canClaim" class="btn btn-primary" :disabled="busy" @click="claim">Récupérer</button>
    </div>
    <ol class="daily__days">
      <li
        v-for="r in status.rewards"
        :key="r.day"
        :class="{
          done: r.day < status.day || (!status.canClaim && r.day === status.day),
          today: r.day === status.day && status.canClaim,
          big: r.topCard,
        }"
      >
        <span class="daily__label">J{{ r.day }}</span>
        <span class="daily__icon">{{ icon(r) }}</span>
        <span class="daily__value">{{ short(r) }}</span>
      </li>
    </ol>
    <div v-if="won" class="daily__won">
      <CarCard :card="won" size="sm" />
    </div>
  </section>
</template>

<style scoped>
.daily {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 18px;
}

.daily.ready {
  border-color: var(--accent-2);
  box-shadow: 0 0 22px rgba(255, 176, 32, 0.2);
}

.daily__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.daily__head strong,
.daily__head small {
  display: block;
}

.daily__days {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.daily__days li {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 8px 2px;
  border-radius: 10px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  font-size: 0.78rem;
}

.daily__days li.done {
  opacity: 0.45;
}

.daily__days li.done .daily__icon::after {
  content: ' ✓';
  font-size: 0.7rem;
  color: var(--success);
}

.daily__days li.today {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 15%, var(--bg-2));
}

.daily__days li.big {
  border-color: var(--r-epic);
}

.daily__label {
  color: var(--muted);
  font-weight: 700;
}

.daily__icon {
  font-size: 1.2rem;
}

.daily__value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.daily__won {
  width: 150px;
  justify-self: center;
}
</style>
