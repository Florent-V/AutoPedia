<script setup lang="ts">
const props = defineProps<{ cardId: number }>();
const emit = defineEmits<{ close: [] }>();

const card = ref<Card | null>(null);
const error = ref<string | null>(null);

watch(
  () => props.cardId,
  async (id) => {
    card.value = null;
    error.value = null;
    try {
      card.value = await api<Card>(`/cars/${id}`);
    } catch (err) {
      error.value = apiErrorMessage(err, 'Impossible de charger la carte');
    }
  },
  { immediate: true },
);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

const owned = computed(() => (card.value?.quantity ?? 0) > 0);
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="modal__box panel">
      <button class="modal__close" aria-label="Fermer" @click="emit('close')">✕</button>
      <p v-if="error" class="error">{{ error }}</p>
      <div v-else-if="!card" class="muted">Chargement…</div>
      <div v-else class="modal__content">
        <div class="modal__card">
          <CarCard :card="card" :locked="!owned" size="lg" />
        </div>
        <div class="modal__details">
          <span class="rarity-pill" :class="`r-${card.rarity.toLowerCase()}`">
            {{ RARITY_META[card.rarity].label }} · {{ card.points }} pts
          </span>
          <h2>{{ card.name }}</h2>
          <dl class="facts">
            <div v-if="card.manufacturer"><dt>Constructeur</dt><dd>{{ card.manufacturer }}</dd></div>
            <div v-if="card.country"><dt>Pays</dt><dd>{{ card.country }}</dd></div>
            <div v-if="card.yearStart"><dt>Production</dt><dd>{{ formatYears(card) }}</dd></div>
            <div><dt>Catégorie</dt><dd>{{ card.racing ? 'Course 🏁' : 'Route' }}</dd></div>
            <div v-if="card.powerHp"><dt>Puissance</dt><dd>{{ formatNumber(card.powerHp) }} ch</dd></div>
            <div v-if="card.topSpeedKmh"><dt>Vitesse max.</dt><dd>{{ formatNumber(card.topSpeedKmh) }} km/h</dd></div>
            <div v-if="card.massKg"><dt>Masse</dt><dd>{{ formatNumber(card.massKg) }} kg</dd></div>
            <div v-if="card.lengthMm"><dt>Longueur</dt><dd>{{ (card.lengthMm / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }} m</dd></div>
            <div><dt>Exemplaires</dt><dd>{{ card.quantity ?? 0 }}</dd></div>
          </dl>
          <template v-if="owned">
            <p v-if="card.summary" class="summary">{{ card.summary }}</p>
            <p v-else class="muted">Pas de résumé disponible pour le moment.</p>
            <div class="modal__actions">
              <a v-if="card.wikiUrl" :href="card.wikiUrl" target="_blank" rel="noopener" class="btn">Lire l’article Wikipédia ↗</a>
              <NuxtLink :to="{ path: '/market', query: { tab: 'trades', sell: card.id } }" class="btn" @click="emit('close')">
                🤝 Proposer à l’échange
              </NuxtLink>
            </div>
          </template>
          <p v-else class="muted">Ouvrez des boosters pour obtenir cette carte et découvrir son histoire.</p>
          <p v-if="owned && card.imageCredit" class="credit">
            Photo :
            <a :href="card.imageCredit.sourceUrl" target="_blank" rel="noopener">{{ card.imageCredit.author || 'auteur inconnu' }}</a>
            <template v-if="card.imageCredit.license">
              ·
              <a v-if="card.imageCredit.licenseUrl" :href="card.imageCredit.licenseUrl" target="_blank" rel="noopener license">{{ card.imageCredit.license }}</a>
              <span v-else>{{ card.imageCredit.license }}</span>
            </template>
            · Wikimedia Commons
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(3, 5, 10, 0.8);
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.modal__box {
  position: relative;
  width: min(880px, 100%);
}

.modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.modal__content {
  display: grid;
  grid-template-columns: minmax(0, 320px) 1fr;
  gap: 28px;
  align-items: start;
}

@media (max-width: 720px) {
  .modal__content {
    grid-template-columns: 1fr;
  }
  .modal__card {
    max-width: 280px;
    margin: 0 auto;
    width: 100%;
  }
}

.modal__details h2 {
  margin-top: 10px;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin: 0 0 16px;
}

.facts div {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
}

.facts dt {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.facts dd {
  margin: 2px 0 0;
  font-weight: 600;
}

.modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.credit {
  margin-top: 16px;
  font-size: 0.78rem;
  color: var(--muted);
}

.credit a {
  color: inherit;
}

.summary {
  line-height: 1.6;
  color: #cdd5e4;
}

.rarity-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.8rem;
  color: #111;
  background: var(--r-common);
}
.rarity-pill.r-uncommon {
  background: var(--r-uncommon);
}
.rarity-pill.r-rare {
  background: var(--r-rare);
}
.rarity-pill.r-epic {
  background: var(--r-epic);
}
.rarity-pill.r-legendary {
  background: var(--r-legendary);
}
</style>
