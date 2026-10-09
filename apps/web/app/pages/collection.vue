<script setup lang="ts">
interface Page {
  page: number;
  pages: number;
  total: number;
  items: Card[];
}
interface Summary {
  rarities: { rarity: Rarity; label: string; total: number; owned: number; points: number }[];
  manufacturers: { name: string; total: number; owned: number }[];
}

const route = useRoute();
const router = useRouter();
const player = usePlayerState();

const filters = reactive({
  search: (route.query.search as string) ?? '',
  rarity: (route.query.rarity as string) ?? '',
  manufacturer: (route.query.manufacturer as string) ?? '',
  owned: (route.query.owned as string) ?? 'all',
  sort: (route.query.sort as string) ?? 'rarity',
  page: Number(route.query.page ?? 1),
});

const data = ref<Page | null>(null);
const summary = ref<Summary | null>(null);
const loading = ref(false);
const selected = ref<number | null>(null);

const totalOwned = computed(() => summary.value?.rarities.reduce((s, r) => s + r.owned, 0) ?? 0);
const totalCards = computed(() => summary.value?.rarities.reduce((s, r) => s + r.total, 0) ?? 0);
const completion = computed(() => (totalCards.value ? (totalOwned.value / totalCards.value) * 100 : 0));

async function load() {
  loading.value = true;
  const query: Record<string, string | number> = { owned: filters.owned, sort: filters.sort, page: filters.page, pageSize: 30 };
  if (filters.search) query.search = filters.search;
  if (filters.rarity) query.rarity = filters.rarity;
  if (filters.manufacturer) query.manufacturer = filters.manufacturer;
  void router.replace({ query: { ...query, pageSize: undefined } });
  try {
    data.value = await api<Page>('/collection', { query });
  } finally {
    loading.value = false;
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [filters.search, filters.rarity, filters.manufacturer, filters.owned, filters.sort],
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.page = 1;
      void load();
    }, 250);
  },
);

function goTo(page: number) {
  filters.page = page;
  void load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
  await Promise.all([load(), api<Summary>('/collection/summary').then((s) => (summary.value = s))]);
});
</script>

<template>
  <div class="container page">
    <div class="page-head">
      <div>
        <h1>Ma collection</h1>
        <p>
          {{ formatNumber(totalOwned) }} / {{ formatNumber(totalCards) }} cartes ·
          {{ completion.toFixed(1) }} % · ⭐ {{ formatNumber(player?.stats.points ?? 0) }} points
        </p>
      </div>
    </div>

    <section v-if="summary" class="rarity-bars">
      <button
        v-for="r in summary.rarities"
        :key="r.rarity"
        class="rarity-bar panel"
        :class="[`r-${r.rarity.toLowerCase()}`, { active: filters.rarity === r.rarity }]"
        @click="filters.rarity = filters.rarity === r.rarity ? '' : r.rarity"
      >
        <span class="rarity-bar__label">{{ r.label }}</span>
        <strong>{{ r.owned }}<small>/{{ r.total }}</small></strong>
        <div class="progress"><span :style="{ width: `${r.total ? (r.owned / r.total) * 100 : 0}%` }" /></div>
      </button>
    </section>

    <section class="filters panel">
      <input v-model="filters.search" class="input" type="search" placeholder="Rechercher un modèle ou une marque…" aria-label="Recherche" />
      <select v-model="filters.manufacturer" class="select" aria-label="Constructeur">
        <option value="">Tous les constructeurs</option>
        <option v-for="m in summary?.manufacturers ?? []" :key="m.name" :value="m.name">
          {{ m.name }} ({{ m.owned }}/{{ m.total }})
        </option>
      </select>
      <select v-model="filters.owned" class="select" aria-label="Possession">
        <option value="all">Toutes les cartes</option>
        <option value="owned">Possédées</option>
        <option value="missing">Manquantes</option>
      </select>
      <select v-model="filters.sort" class="select" aria-label="Tri">
        <option value="rarity">Tri : rareté</option>
        <option value="name">Tri : nom</option>
        <option value="year">Tri : année</option>
        <option value="recent">Tri : ajout au catalogue</option>
      </select>
    </section>

    <p v-if="data && !data.items.length" class="muted empty">Aucune carte ne correspond à ces critères.</p>

    <section class="grid-cards" :class="{ loading }">
      <button
        v-for="card in data?.items ?? []"
        :key="card.id"
        type="button"
        class="cell"
        :aria-label="card.name"
        @click="selected = card.id"
      >
        <CarCard :card="card" :locked="!card.quantity" size="sm" :interactive="!!card.quantity" />
      </button>
    </section>

    <nav v-if="data && data.pages > 1" class="pager">
      <button class="btn" :disabled="data.page <= 1" @click="goTo(data.page - 1)">← Précédent</button>
      <span class="muted">Page {{ data.page }} / {{ data.pages }}</span>
      <button class="btn" :disabled="data.page >= data.pages" @click="goTo(data.page + 1)">Suivant →</button>
    </nav>

    <CardModal v-if="selected !== null" :card-id="selected" @close="selected = null" />
  </div>
</template>

<style scoped>
.rarity-bars {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 800px) {
  .rarity-bars {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.rarity-bar {
  --c: var(--r-common);
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  text-align: left;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  border-color: color-mix(in srgb, var(--c) 30%, var(--border));
}

.rarity-bar.active {
  border-color: var(--c);
  box-shadow: 0 0 0 2px var(--c);
}

.rarity-bar .progress > span {
  background: var(--c);
}

.rarity-bar__label {
  color: var(--c);
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rarity-bar small {
  color: var(--muted);
  font-weight: 500;
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

.filters {
  display: grid;
  grid-template-columns: 2fr 1.4fr 1fr 1fr;
  gap: 10px;
  padding: 12px;
  margin-bottom: 24px;
}

@media (max-width: 800px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }
  .filters .input {
    grid-column: 1 / -1;
  }
}

.cell {
  all: unset;
  cursor: pointer;
  display: flex;
  justify-content: center;
}

.cell:focus-visible {
  outline: 3px solid var(--accent-2);
  outline-offset: 4px;
  border-radius: 10px;
}

.loading {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.empty {
  text-align: center;
  padding: 40px 0;
}

.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}
</style>
