<script setup lang="ts">
/** Mise aux enchères d'une de mes cartes. */
const props = defineProps<{ initialCardId?: number | null; durations: number[]; feePercent: number; priceFloor?: Record<Rarity, number> }>();
const emit = defineEmits<{ close: []; created: [] }>();

/** Mise à prix suggérée : la moitié du prix boutique de la rareté. */
const SUGGESTED: Record<Rarity, number> = { COMMON: 20, UNCOMMON: 60, RARE: 200, EPIC: 600, LEGENDARY: 2000 };

const card = ref<Card | null>(null);
const startPrice = ref(20);
/** Mise à prix minimale imposée par le serveur pour la rareté de la carte. */
const floor = computed(() => (card.value && props.priceFloor?.[card.value.rarity]) || 1);
const duration = ref(props.durations.includes(6) ? 6 : props.durations[0]!);
const picking = ref(false);
const error = ref<string | null>(null);
const busy = ref(false);

onMounted(async () => {
  if (props.initialCardId) {
    const c = await api<Card>(`/cars/${props.initialCardId}`).catch(() => null);
    if (c?.quantity) pick(c);
  }
  if (!card.value) picking.value = true;
});

function pick(c: Card) {
  card.value = c;
  startPrice.value = SUGGESTED[c.rarity];
  picking.value = false;
}

async function submit() {
  if (!card.value) return;
  busy.value = true;
  error.value = null;
  try {
    await api('/auctions', {
      method: 'POST',
      body: { carId: card.value.id, startPrice: Math.round(startPrice.value), durationHours: duration.value },
    });
    useToasts().push({ title: 'Enchère lancée 🔨', message: `Fin dans ${duration.value} h. La carte est mise de côté jusque-là.`, icon: '📣' });
    emit('created');
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="create" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="create__box panel">
      <header class="create__head">
        <h3>Mettre aux enchères</h3>
        <button class="create__close" aria-label="Fermer" @click="emit('close')">✕</button>
      </header>

      <div class="create__row">
        <button class="create__pick" @click="picking = true">
          <CarCard v-if="card" :card="card" size="sm" :interactive="false" />
          <span v-else class="create__empty">Choisir une carte</span>
        </button>
        <div class="create__form">
          <label class="field">
            <span class="muted">Mise à prix (🪙)</span>
            <input v-model.number="startPrice" class="input" type="number" :min="floor" inputmode="numeric" />
            <small v-if="floor > 1" class="muted">Minimum : {{ floor }} 🪙</small>
          </label>
          <div class="field">
            <span class="muted">Durée</span>
            <div class="durations">
              <button v-for="d in durations" :key="d" class="chip" :class="{ on: duration === d }" @click="duration = d">{{ d }} h</button>
            </div>
          </div>
          <small v-if="card && card.quantity === 1" class="warn">C’est votre seul exemplaire.</small>
        </div>
      </div>

      <p class="muted note">
        La carte est mise de côté pendant l’enchère. À la fin, elle part au meilleur enchérisseur et vous recevez son offre moins
        {{ feePercent }} % de commission. Sans offre, elle revient dans votre collection. Une offre dans les 2 dernières minutes prolonge l’enchère.
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary btn-lg" :disabled="!card || startPrice < floor || busy" @click="submit">Lancer l’enchère</button>
    </div>

    <MarketCardPicker v-if="picking" title="Quelle carte mettre aux enchères ?" :owned="true" @pick="pick" @close="picking = false" />
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
  width: min(520px, 100%);
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
  grid-template-columns: minmax(0, 150px) 1fr;
  gap: 16px;
  align-items: start;
}

.create__pick {
  all: unset;
  cursor: pointer;
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

.create__form {
  display: grid;
  gap: 4px;
}

.durations {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.durations .chip {
  cursor: pointer;
  color: var(--text);
  font: inherit;
  font-size: 0.85rem;
}

.chip.on {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 18%, var(--surface));
}

.warn {
  color: var(--accent-2);
}

.note {
  font-size: 0.85rem;
  margin: 0;
}
</style>
