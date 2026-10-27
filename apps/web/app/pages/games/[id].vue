<script setup lang="ts">
type GameType = 'DUEL' | 'QUIZ' | 'WEIGHT' | 'MYSTERY' | 'DOORS';

interface MiniCard {
  id: number;
  name: string;
  manufacturer: string | null;
  imageUrl: string | null;
  rarity: Rarity;
}
interface Question {
  // Duel / Poids lourds
  stat?: string;
  question?: string;
  a?: MiniCard;
  b?: MiniCard;
  // Quiz / Question pour une carte
  kind?: string;
  prompt?: string;
  car?: { name: string | null; imageUrl: string | null };
  card?: MiniCard;
  choices?: string[];
  // Les 3 garages
  doors?: number;
}
interface Session {
  id: string;
  type: GameType;
  name: string;
  reward: 'credits' | 'card';
  status: 'ACTIVE' | 'FINISHED';
  round: number;
  total: number;
  score: number;
  credits: number;
  creditsPerWin: number;
  history: Array<{ correct: boolean }>;
  question: Question | null;
}
interface DoorReveal {
  tier: 'none' | 'standard' | 'top';
  card: Card | null;
}
interface AnswerResult {
  correct: boolean;
  answer: 'a' | 'b' | number | null;
  reveal: { a: string; b: string } | null;
  doors: DoorReveal[] | null;
  prize: Card | null;
  gained: number;
  balance: number;
  session: Session;
  summary: {
    score: number;
    credits: number;
    rewardCard: Card | null;
    prize: Card | null;
  } | null;
  /** Succès débloqués par cette réponse. */
  newAchievements: Achievement[];
}

const route = useRoute();
const session = ref<Session | null>(null);
const question = ref<Question | null>(null);
const result = ref<AnswerResult | null>(null);
const picked = ref<string | number | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
/** Portes déjà levées (animation d'ouverture : la porte choisie d'abord, puis les autres). */
const opened = ref<boolean[]>([false, false, false]);
/** Images qui n'ont pas pu être chargées (repli sur le dessin technique). */
const broken = reactive(new Set<string>());
const showImg = (url: string | null | undefined) => !!url && !broken.has(url);

const isPair = computed(() => session.value?.type === 'DUEL' || session.value?.type === 'WEIGHT');
const isChoices = computed(() => session.value?.type === 'QUIZ' || session.value?.type === 'MYSTERY');
const isDoors = computed(() => session.value?.type === 'DOORS');
const cardGame = computed(() => session.value?.reward === 'card');

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
    if (res.doors) {
      // Lève la porte choisie, puis les deux autres.
      opened.value = opened.value.map((_, i) => i === choice);
      setTimeout(() => (opened.value = [true, true, true]), 900);
    }
    const top = res.prize && (res.prize.rarity === 'EPIC' || res.prize.rarity === 'LEGENDARY');
    haptic(top ? [40, 60, 40, 60, 120] : res.correct ? 20 : [40, 40, 40]);
    notifyAchievements(res.newAchievements, res.summary ? 900 : 300);
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
const feedback = computed(() => {
  const r = result.value;
  if (!r) return '';
  if (isDoors.value) {
    if (!r.prize) return 'Garage vide… pas de chance !';
    return r.doors?.[picked.value as number]?.tier === 'top' ? 'Le gros lot ! 👑' : 'Une carte pour votre garage !';
  }
  // Sur une erreur, on rappelle la bonne réponse (elle peut être masquée par cette barre sur petit écran).
  const right = typeof r.answer === 'number' ? question.value?.choices?.[r.answer] : null;
  const missed = right ? `Raté ! C’était « ${right} ».` : 'Raté !';
  if (cardGame.value) return r.correct ? 'Bonne réponse : la carte est à vous ! 🎉' : `${missed} La carte vous échappe…`;
  return r.correct ? `Bonne réponse ! +${r.gained} 🪙` : missed;
});
const rarityLabel = (r: Rarity) => RARITY_META[r].label;
</script>

<template>
  <div class="container page play">
    <p v-if="error" class="error">{{ error }} <NuxtLink to="/games">Retour aux jeux</NuxtLink></p>

    <template v-if="session">
      <header class="play__head">
        <NuxtLink to="/games" class="btn btn-ghost">←</NuxtLink>
        <div class="play__title">
          <strong>{{ session.name }}</strong>
          <small v-if="session.total > 1" class="muted">Manche {{ Math.min(session.round, session.total) }}/{{ session.total }}</small>
          <small v-else class="muted">Une carte à gagner</small>
        </div>
        <span v-if="!cardGame" class="chip">✅ {{ (result?.session ?? session).score }} · 🪙 +{{ (result?.session ?? session).credits }}</span>
      </header>
      <div v-if="session.total > 1" class="play__track">
        <span
          v-for="i in session.total"
          :key="i"
          :class="{
            ok: (result?.session ?? session).history[i - 1]?.correct === true,
            ko: (result?.session ?? session).history[i - 1]?.correct === false,
          }"
        />
      </div>

      <!-- Duel de stats / Poids lourds -->
      <section v-if="isPair && question && !finished" class="duel">
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
            <span v-if="session.type === 'WEIGHT'" class="rarity-tag" :class="`r-${question[side]!.rarity.toLowerCase()}`">
              {{ rarityLabel(question[side]!.rarity) }}
            </span>
            <span v-if="result?.reveal" class="duel__value">{{ result.reveal[side] }}</span>
          </button>
          <span class="duel__vs">{{ session.type === 'WEIGHT' ? '⚖️' : 'VS' }}</span>
        </div>
      </section>

      <!-- Quiz / Question pour une carte -->
      <section v-if="isChoices && question && !finished" class="quiz">
        <div v-if="question.card" class="mystery">
          <div class="mystery__img" :class="`r-${question.card.rarity.toLowerCase()}`">
            <img
              v-if="showImg(question.card.imageUrl)"
              :src="question.card.imageUrl!"
              :alt="question.card.name"
              referrerpolicy="no-referrer"
              @error="broken.add(question.card.imageUrl!)"
            />
            <CarLineArt v-else class="duel__art" />
          </div>
          <div class="mystery__info">
            <span class="rarity-tag" :class="`r-${question.card.rarity.toLowerCase()}`">{{ rarityLabel(question.card.rarity) }} en jeu</span>
            <strong>{{ question.card.name }}</strong>
            <small class="muted">{{ question.card.manufacturer }}</small>
          </div>
        </div>
        <div v-else-if="showImg(question.car?.imageUrl)" class="quiz__img">
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

      <!-- Les 3 garages -->
      <section v-if="isDoors && (question || result?.doors)" class="garages">
        <h2 class="play__question">{{ question?.prompt ?? 'Derrière quelle porte se cache la meilleure voiture ?' }}</h2>
        <div class="garages__row">
          <button
            v-for="i in 3"
            :key="i"
            class="garage"
            :class="{ chosen: picked === i - 1, open: opened[i - 1] }"
            :disabled="!!result || busy"
            :aria-label="`Porte ${i}`"
            @click="answer(i - 1)"
          >
            <div class="garage__inside">
              <template v-if="result?.doors?.[i - 1]">
                <CarCard v-if="result.doors[i - 1]?.card" :card="result.doors[i - 1]!.card!" size="sm" :interactive="false" />
                <span v-else class="garage__empty">Vide 💨</span>
              </template>
            </div>
            <div class="garage__door">
              <span class="garage__num">{{ i }}</span>
            </div>
            <div class="garage__roof" />
          </button>
        </div>
      </section>

      <div v-if="result && !finished" class="play__feedback" :class="result.correct ? 'ok' : 'ko'">
        <strong>{{ feedback }}</strong>
        <button class="btn btn-primary" @click="next">
          {{ result.summary ? 'Voir le résultat' : 'Question suivante' }}
        </button>
      </div>

      <section v-if="session.status === 'FINISHED' && !result" class="panel summary">
        <h2>Partie terminée</h2>
        <p v-if="!cardGame" class="summary__score">{{ session.score }}/{{ session.total }}</p>
        <p v-if="!cardGame">🪙 +{{ session.credits }} crédits</p>
        <p v-else>{{ session.score ? 'Carte gagnée 🎉' : 'Pas de carte cette fois.' }}</p>
        <NuxtLink to="/games" class="btn btn-primary">Retour aux jeux</NuxtLink>
      </section>

      <!-- Résultat -->
      <section v-if="result?.summary && (finished || !question)" class="panel summary">
        <template v-if="cardGame">
          <h2>{{ result.summary.prize ? 'Carte gagnée ! 🎉' : 'Pas de chance…' }}</h2>
          <div v-if="result.summary.prize" class="summary__reward">
            <CarCard :card="result.summary.prize" size="md" />
            <p class="muted">{{ result.summary.prize.isNew ? 'Nouvelle carte dans votre garage !' : `Vous en avez maintenant ${result.summary.prize.quantity}.` }}</p>
          </div>
          <p v-else class="muted">Retentez votre chance : il vous reste peut-être des parties aujourd’hui.</p>
        </template>
        <template v-else>
          <h2>{{ result.summary.score >= session.total ? 'Sans-faute ! 🏆' : 'Partie terminée' }}</h2>
          <p class="summary__score">{{ result.summary.score }}/{{ session.total }}</p>
          <p>🪙 +{{ result.summary.credits }} crédits · solde {{ formatNumber(result.balance) }}</p>
          <div v-if="result.summary.rewardCard" class="summary__reward">
            <p><strong>Carte bonus gagnée :</strong></p>
            <CarCard :card="result.summary.rewardCard" size="md" />
          </div>
        </template>
        <div class="summary__actions">
          <NuxtLink to="/games" class="btn btn-primary">Retour aux jeux</NuxtLink>
          <NuxtLink v-if="cardGame" to="/collection" class="btn">Ma collection</NuxtLink>
          <NuxtLink v-else to="/market" class="btn">Dépenser mes crédits</NuxtLink>
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
  margin-bottom: 14px;
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
  margin: 0 0 22px;
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
  margin: 8px 0 18px;
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
  justify-items: center;
  gap: 6px;
  padding: 10px 10px 14px;
  text-align: center;
}

.duel__card:hover:not(:disabled),
.quiz__choice:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent-2);
}

.duel__img,
.mystery__img,
.quiz__img {
  aspect-ratio: 4 / 3;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: #0d1422;
  display: grid;
  place-items: center;
}

.duel__img img,
.mystery__img img,
.quiz__img img {
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

.rarity-tag {
  --c: var(--r-common);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  color: #111;
  background: var(--c);
}

.r-uncommon {
  --c: var(--r-uncommon);
}
.r-rare {
  --c: var(--r-rare);
}
.r-epic {
  --c: var(--r-epic);
}
.r-legendary {
  --c: var(--r-legendary);
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

.mystery {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 1fr;
  gap: 14px;
  align-items: center;
  max-width: 560px;
  margin: 0 auto;
}

.mystery__img {
  border: 3px solid var(--c);
  box-shadow: 0 0 20px color-mix(in srgb, var(--c) 45%, transparent);
}

.mystery__info {
  display: grid;
  gap: 6px;
  justify-items: start;
}

.mystery__info strong {
  font: 1.2rem var(--font-display);
}

.quiz__img {
  max-width: 460px;
  margin: 0 auto 16px;
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
  .mystery {
    grid-template-columns: 1fr;
    justify-items: center;
  }
  .mystery__info {
    justify-items: center;
    text-align: center;
  }
}

.quiz__choice {
  padding: 16px 14px;
  font-weight: 600;
  text-align: left;
}

/* Les 3 garages */
.garages__row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 620px;
  margin: 0 auto;
}

.garage {
  all: unset;
  position: relative;
  cursor: pointer;
  aspect-ratio: 3 / 4;
  border-radius: 10px 10px 4px 4px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 80%, #1c2538, #070a11);
  border: 3px solid #39445c;
  border-top-width: 14px;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}

.garage:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--accent-2);
}

.garage:focus-visible {
  outline: 3px solid var(--accent-2);
  outline-offset: 4px;
}

.garage.chosen {
  border-color: var(--accent-2);
  box-shadow: 0 0 24px rgba(255, 176, 32, 0.45);
}

.garage__inside {
  position: absolute;
  inset: 8px;
  display: grid;
  place-items: center;
}

.garage__inside :deep(.car-card) {
  max-width: 100%;
}

.garage__empty {
  font: 1rem var(--font-display);
  color: var(--muted);
}

.garage__door {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background:
    repeating-linear-gradient(180deg, #b9c2d3 0 10px, #8d97ab 10px 12px, #a3adc0 12px 22px),
    #a3adc0;
  box-shadow: inset 0 -8px 16px rgba(0, 0, 0, 0.35);
  transition: transform 0.8s cubic-bezier(0.5, 0, 0.2, 1);
}

.garage.open .garage__door {
  transform: translateY(-96%);
}

.garage__num {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #0b0f17;
  color: var(--accent-2);
  font: 1.3rem var(--font-display);
  box-shadow: 0 0 0 3px #39445c;
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
  margin-top: 16px;
}

.summary__score {
  font: 3rem var(--font-display);
  margin: 0;
}

.summary__reward {
  display: grid;
  justify-items: center;
  gap: 6px;
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
