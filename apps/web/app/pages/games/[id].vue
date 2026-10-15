<script setup lang="ts">
interface MiniCard {
  id: number;
  name: string;
  manufacturer: string | null;
  imageUrl: string | null;
  rarity: Rarity;
}
interface Question {
  // Duel
  stat?: string;
  question?: string;
  a?: MiniCard;
  b?: MiniCard;
  // Quiz
  kind?: 'brand' | 'country' | 'decade' | 'photo';
  prompt?: string;
  car?: { name: string | null; imageUrl: string | null };
  choices?: string[];
}
interface Session {
  id: string;
  type: 'DUEL' | 'QUIZ';
  name: string;
  status: 'ACTIVE' | 'FINISHED';
  round: number;
  total: number;
  score: number;
  credits: number;
  creditsPerWin: number;
  history: Array<{ correct: boolean }>;
  question: Question | null;
}
interface AnswerResult {
  correct: boolean;
  answer: 'a' | 'b' | number;
  reveal: { a: string; b: string } | null;
  gained: number;
  balance: number;
  session: Session;
  summary: { score: number; credits: number; rewardCard: Card | null; newAchievements: Achievement[] } | null;
}

const route = useRoute();
const session = ref<Session | null>(null);
const question = ref<Question | null>(null);
const result = ref<AnswerResult | null>(null);
const picked = ref<string | number | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
/** Images qui n'ont pas pu être chargées (repli sur le dessin technique). */
const broken = reactive(new Set<string>());
const showImg = (url: string | null | undefined) => !!url && !broken.has(url);

onMounted(async () => {
  try {
    session.value = await api<Session>(`/games/sessions/${route.params.id}`);
    question.value = session.value.question;
  } catch (err) {
    error.value = apiErrorMessage(err, 'Partie introuvable');
  }
});

async function answer(choice: 'a' | 'b' | number) {
  if (!session.value || result.value || busy.value) return;
  busy.value = true;
  picked.value = choice;
  try {
    const res = await api<AnswerResult>(`/games/sessions/${session.value.id}/answer`, { method: 'POST', body: { choice } });
    result.value = res;
    setCredits(res.balance);
    haptic(res.correct ? 20 : [40, 40, 40]);
    if (res.summary) notifyAchievements(res.summary.newAchievements, 600);
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    busy.value = false;
  }
}

function next() {
  if (!result.value) return;
  session.value = result.value.session;
  question.value = result.value.session.question;
  if (!result.value.summary) {
    result.value = null;
    picked.value = null;
  }
}

const finished = computed(() => !!result.value?.summary && session.value?.status === 'FINISHED' && !question.value);
const stateOf = (choice: 'a' | 'b' | number) => {
  if (!result.value) return picked.value === choice ? 'picked' : '';
  if (choice === result.value.answer) return 'good';
  return picked.value === choice ? 'bad' : 'dim';
};
</script>

<template>
  <div class="container page play">
    <p v-if="error" class="error">{{ error }} <NuxtLink to="/games">Retour aux jeux</NuxtLink></p>

    <template v-if="session">
      <header class="play__head">
        <NuxtLink to="/games" class="btn btn-ghost">←</NuxtLink>
        <div class="play__title">
          <strong>{{ session.name }}</strong>
          <small class="muted">Manche {{ Math.min(session.round, session.total) }}/{{ session.total }}</small>
        </div>
        <span class="chip">✅ {{ (result?.session ?? session).score }} · 🪙 +{{ (result?.session ?? session).credits }}</span>
      </header>
      <div class="play__track">
        <span
          v-for="i in session.total"
          :key="i"
          :class="{
            ok: (result?.session ?? session).history[i - 1]?.correct === true,
            ko: (result?.session ?? session).history[i - 1]?.correct === false,
          }"
        />
      </div>

      <!-- Duel -->
      <section v-if="session.type === 'DUEL' && question && !finished" class="duel">
        <h2 class="play__question">{{ question.question }}</h2>
        <div class="duel__cards">
          <button
            v-for="side in (['a', 'b'] as const)"
            :key="side"
            class="duel__card"
            :class="stateOf(side)"
            :disabled="!!result || busy"
            @click="answer(side)"
          >
            <div class="duel__img">
              <img
                v-if="showImg(question[side]!.imageUrl)"
                :src="question[side]!.imageUrl!"
                :alt="question[side]!.name"
                referrerpolicy="no-referrer"
                @error="broken.add(question[side]!.imageUrl!)"
              />
              <CarLineArt v-else class="duel__art" />
            </div>
            <strong>{{ question[side]!.name }}</strong>
            <small class="muted">{{ question[side]!.manufacturer }}</small>
            <span v-if="result?.reveal" class="duel__value">{{ result.reveal[side] }}</span>
          </button>
          <span class="duel__vs">VS</span>
        </div>
      </section>

      <!-- Quiz -->
      <section v-if="session.type === 'QUIZ' && question && !finished" class="quiz">
        <div v-if="showImg(question.car?.imageUrl)" class="quiz__img">
          <img :src="question.car!.imageUrl!" alt="" referrerpolicy="no-referrer" @error="broken.add(question.car!.imageUrl!)" />
        </div>
        <h2 class="play__question">{{ question.prompt }}</h2>
        <div class="quiz__choices">
          <button
            v-for="(c, i) in question.choices"
            :key="i"
            class="quiz__choice"
            :class="stateOf(i)"
            :disabled="!!result || busy"
            @click="answer(i)"
          >
            {{ c }}
          </button>
        </div>
      </section>

      <div v-if="result && !finished" class="play__feedback" :class="result.correct ? 'ok' : 'ko'">
        <strong>{{ result.correct ? `Bonne réponse ! +${result.gained} 🪙` : 'Raté !' }}</strong>
        <button class="btn btn-primary" @click="next">
          {{ result.summary ? 'Voir le résultat' : 'Question suivante' }}
        </button>
      </div>

      <section v-if="session.status === 'FINISHED' && !result" class="panel summary">
        <h2>Partie terminée</h2>
        <p class="summary__score">{{ session.score }}/{{ session.total }}</p>
        <p>🪙 +{{ session.credits }} crédits</p>
        <NuxtLink to="/games" class="btn btn-primary">Retour aux jeux</NuxtLink>
      </section>

      <!-- Résultat -->
      <section v-if="result?.summary && (finished || !question)" class="panel summary">
        <h2>{{ result.summary.score >= session.total ? 'Sans-faute ! 🏆' : 'Partie terminée' }}</h2>
        <p class="summary__score">{{ result.summary.score }}/{{ session.total }}</p>
        <p>🪙 +{{ result.summary.credits }} crédits · solde {{ formatNumber(result.balance) }}</p>
        <div v-if="result.summary.rewardCard" class="summary__reward">
          <p><strong>Carte bonus gagnée :</strong></p>
          <CarCard :card="result.summary.rewardCard" size="md" />
        </div>
        <div class="summary__actions">
          <NuxtLink to="/games" class="btn btn-primary">Retour aux jeux</NuxtLink>
          <NuxtLink to="/market" class="btn">Dépenser mes crédits</NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.play {
  max-width: 760px;
}

.play__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play__head .btn {
  padding: 8px 14px;
}

.play__title {
  flex: 1;
  display: grid;
}

.play__track {
  display: flex;
  gap: 6px;
  margin: 14px 0 22px;
}

.play__track span {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
}

.play__track .ok {
  background: var(--success);
}

.play__track .ko {
  background: var(--danger);
}

.play__question {
  text-align: center;
  font-size: clamp(1.15rem, 3.5vw, 1.5rem);
  margin-bottom: 18px;
}

.duel__cards {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.duel__vs {
  position: absolute;
  left: 50%;
  top: 38%;
  transform: translate(-50%, -50%);
  font: 1.3rem var(--font-display);
  background: var(--accent);
  border-radius: 999px;
  padding: 8px 10px;
  box-shadow: 0 0 20px rgba(255, 61, 61, 0.6);
  pointer-events: none;
}

.duel__card,
.quiz__choice {
  font: inherit;
  color: var(--text);
  cursor: pointer;
  border: 2px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius);
  transition:
    transform 0.15s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.duel__card {
  display: grid;
  gap: 6px;
  padding: 10px 10px 14px;
  text-align: center;
}

.duel__card:hover:not(:disabled),
.quiz__choice:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent-2);
}

.duel__img {
  aspect-ratio: 4 / 3;
  border-radius: 10px;
  overflow: hidden;
  background: #0d1422;
  display: grid;
  place-items: center;
}

.duel__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duel__art {
  width: 80%;
  color: var(--r-rare);
}

.duel__value {
  font: 1.2rem var(--font-display);
  color: var(--accent-2);
}

.good {
  border-color: var(--success) !important;
  box-shadow: 0 0 18px rgba(52, 211, 153, 0.35);
}

.bad {
  border-color: var(--danger) !important;
}

.dim {
  opacity: 0.55;
}

.picked {
  border-color: var(--accent-2);
}

.quiz__img {
  max-width: 460px;
  margin: 0 auto 16px;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius);
  overflow: hidden;
  background: #0d1422;
}

.quiz__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quiz__choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 520px) {
  .quiz__choices {
    grid-template-columns: 1fr;
  }
}

.quiz__choice {
  padding: 16px 14px;
  font-weight: 600;
  text-align: left;
}

.play__feedback {
  position: sticky;
  bottom: calc(84px + env(safe-area-inset-bottom));
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

@media (min-width: 861px) {
  .play__feedback {
    bottom: 16px;
  }
}

.play__feedback.ok strong {
  color: var(--success);
}

.play__feedback.ko strong {
  color: var(--danger);
}

.summary {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 8px;
}

.summary__score {
  font: 3rem var(--font-display);
  margin: 0;
}

.summary__reward {
  display: grid;
  justify-items: center;
  width: min(260px, 70vw);
}

.summary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 8px;
}
</style>
