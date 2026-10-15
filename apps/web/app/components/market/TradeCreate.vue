<script setup lang="ts">
/** Création d'une offre de bourse : une de mes cartes contre des crédits ou contre une carte précise. */
const props = defineProps<{ initialCardId?: number | null }>();
const emit = defineEmits<{ close: []; created: [] }>();

const SUGGESTED: Record<Rarity, number> = { COMMON: 30, UNCOMMON: 90, RARE: 300, EPIC: 900, LEGENDARY: 3000 };

const offered = ref<Card | null>(null);
const wanted = ref<Card | null>(null);
const mode = ref<'credits' | 'card'>('credits');
const price = ref<number>(50);
const picking = ref<'offered' | 'wanted' | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);

onMounted(async () => {
  if (props.initialCardId) {
    const card = await api<Card>(`/cars/${props.initialCardId}`).catch(() => null);
    if (card && card.quantity) pickOffered(card);
  }
  if (!offered.value) picking.value = 'offered';
});

function pickOffered(card: Card) {
  offered.value = card;
  price.value = SUGGESTED[card.rarity];
  picking.value = null;
}

async function submit() {
  if (!offered.value) return;
  error.value = null;
  busy.value = true;
  try {
    await api('/trades', {
      method: 'POST',
      body: mode.value === 'credits'
        ? { offeredCarId: offered.value.id, price: Math.round(price.value) }
        : { offeredCarId: offered.value.id, wantedCarId: wanted.value?.id },
    });
    useToasts().push({ title: 'Offre publiée à la bourse', message: 'La carte est mise de côté jusqu’à l’échange ou l’annulation.', icon: '📢' });
    emit('created');
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    busy.value = false;
  }
}

const valid = computed(() => !!offered.value && (mode.value === 'credits' ? price.value >= 1 : !!wanted.value));
</script>

<template>
  <div class="create" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="create__box panel">
      <header class="create__head">
        <h3>Nouvelle offre</h3>
        <button class="create__close" aria-label="Fermer" @click="emit('close')">✕</button>
      </header>

      <div class="create__row">
        <div class="create__slot">
          <small class="muted">Je propose</small>
          <button class="create__pick" @click="picking = 'offered'">
            <CarCard v-if="offered" :card="offered" size="sm" :interactive="false" />
            <span v-else class="create__empty">Choisir une carte</span>
          </button>
          <small v-if="offered && offered.quantity === 1" class="warn">C’est votre seul exemplaire.</small>
        </div>

        <span class="create__arrow">⇄</span>

        <div class="create__slot">
          <small class="muted">Contre</small>
          <div class="create__modes">
            <button class="chip" :class="{ on: mode === 'credits' }" @click="mode = 'credits'">🪙 Crédits</button>
            <button class="chip" :class="{ on: mode === 'card' }" @click="mode = 'card'">🎴 Une carte</button>
          </div>
          <label v-if="mode === 'credits'" class="field">
            <span class="muted">Prix demandé</span>
            <input v-model.number="price" class="input" type="number" min="1" max="1000000" inputmode="numeric" />
          </label>
          <button v-else class="create__pick" @click="picking = 'wanted'">
            <CarCard v-if="wanted" :card="wanted" size="sm" :interactive="false" />
            <span v-else class="create__empty">Choisir la carte voulue</span>
          </button>
        </div>
      </div>

      <p class="muted create__note">
        La carte proposée quitte votre collection tant que l’offre est ouverte (7 jours maximum). Vous pouvez annuler à tout moment pour la récupérer.
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary btn-lg" :disabled="!valid || busy" @click="submit">Publier l’offre</button>
    </div>

    <MarketCardPicker
      v-if="picking === 'offered'"
      title="Quelle carte proposer ?"
      :owned="true"
      @pick="pickOffered"
      @close="picking = null"
    />
    <MarketCardPicker
      v-if="picking === 'wanted'"
      title="Quelle carte voulez-vous ?"
      :owned="false"
      :exclude="offered?.id"
      @pick="(c) => ((wanted = c), (picking = null))"
      @close="picking = null"
    />
  </div>
</template>

<style scoped>
.create {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(3, 5, 10, 0.8);
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.create__box {
  width: min(560px, 100%);
  display: grid;
  gap: 14px;
}

.create__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.create__head h3 {
  margin: 0;
}

.create__close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.create__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
}

.create__slot {
  display: grid;
  gap: 8px;
  justify-items: center;
}

.create__pick {
  all: unset;
  cursor: pointer;
  width: 100%;
  max-width: 170px;
  display: grid;
}

.create__empty {
  aspect-ratio: 63 / 88;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 10px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
}

.create__arrow {
  font-size: 1.8rem;
  color: var(--accent-2);
}

.create__modes {
  display: flex;
  gap: 6px;
}

.create__modes .chip {
  cursor: pointer;
  color: var(--text);
  font: inherit;
  font-size: 0.82rem;
}

.chip.on {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 18%, var(--surface));
}

.field {
  width: 100%;
  margin: 0;
}

.warn {
  color: var(--accent-2);
}

.create__note {
  font-size: 0.85rem;
  margin: 0;
}
</style>
