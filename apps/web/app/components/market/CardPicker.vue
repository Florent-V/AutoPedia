<script setup lang="ts">
/** Sélecteur de carte (parmi ma collection ou tout le catalogue), avec recherche. */
const props = defineProps<{ title: string; owned: boolean; exclude?: number }>();
const emit = defineEmits<{ pick: [card: Card]; close: [] }>();

const search = ref('');
const items = ref<Card[]>([]);
const loading = ref(false);
let debounce: ReturnType<typeof setTimeout> | undefined;

async function load() {
  loading.value = true;
  try {
    const query: Record<string, string | number> = { owned: props.owned ? 'owned' : 'all', pageSize: 30, sort: 'rarity' };
    if (search.value) query.search = search.value;
    const res = await api<{ items: Card[] }>('/collection', { query });
    items.value = res.items.filter((c) => c.id !== props.exclude);
  } finally {
    loading.value = false;
  }
}

watch(search, () => {
  clearTimeout(debounce);
  debounce = setTimeout(load, 250);
});
onMounted(load);
</script>

<template>
  <div class="picker" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="picker__box panel">
      <header class="picker__head">
        <h3>{{ title }}</h3>
        <button class="picker__close" aria-label="Fermer" @click="emit('close')">✕</button>
      </header>
      <input v-model="search" class="input" type="search" placeholder="Rechercher un modèle ou une marque…" />
      <p v-if="!loading && !items.length" class="muted">Aucune carte trouvée.</p>
      <div class="picker__grid" :class="{ loading }">
        <button v-for="c in items" :key="c.id" class="picker__item" @click="emit('pick', c)">
          <CarCard :card="c" size="sm" :interactive="false" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(3, 5, 10, 0.8);
  backdrop-filter: blur(4px);
}

.picker__box {
  width: min(820px, 100%);
  max-height: calc(100dvh - 32px);
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 12px;
  overflow: hidden;
}

.picker__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.picker__head h3 {
  margin: 0;
}

.picker__close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.picker__grid {
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
  padding: 4px;
}

@media (max-width: 520px) {
  .picker__grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
}

.picker__item {
  all: unset;
  cursor: pointer;
  border-radius: 10px;
}

.picker__item:focus-visible,
.picker__item:hover {
  outline: 2px solid var(--accent-2);
  outline-offset: 2px;
}

.loading {
  opacity: 0.6;
}
</style>
