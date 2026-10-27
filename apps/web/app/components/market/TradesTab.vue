<script setup lang="ts">
interface Offer {
  id: string;
  mine: boolean;
  seller: string;
  sellerIsBot?: boolean;
  createdAt: string;
  expiresAt: string;
  price: number | null;
  offered: Card;
  wanted: Card | null;
  canAccept: boolean;
}
interface Page {
  page: number;
  pages: number;
  total: number;
  balance: number;
  openLimit: number;
  market: { canTrade: boolean; reason: string | null; priceFloor: Record<Rarity, number>; maxSwapRarityGap: number };
  offers: Offer[];
}

const route = useRoute();
const tab = ref<'all' | 'forme' | 'mine'>('all');
const search = ref('');
const rarity = ref('');
const data = ref<Page | null>(null);
const offers = ref<Offer[]>([]);
const busy = ref<string | null>(null);
const creating = ref(false);
const sellCardId = ref<number | null>(null);
const selected = ref<number | null>(null);
const { push } = useToasts();

async function load(page = 1) {
  const query: Record<string, string | number> = { tab: tab.value, page };
  if (search.value) query.search = search.value;
  if (rarity.value) query.rarity = rarity.value;
  const res = await api<Page>('/trades', { query });
  data.value = res;
  offers.value = page === 1 ? res.offers : [...offers.value, ...res.offers];
  setCredits(res.balance);
}

let debounce: ReturnType<typeof setTimeout> | undefined;
watch([tab, rarity], () => void load());
watch(search, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => void load(), 250);
});

onMounted(() => {
  const sell = Number(route.query.sell);
  if (sell) {
    sellCardId.value = sell;
    creating.value = true;
  }
  void load();
});

async function accept(o: Offer) {
  busy.value = o.id;
  try {
    const res = await api<{ card: Card; balance: number; newAchievements: Achievement[] }>(`/trades/${o.id}/accept`, { method: 'POST' });
    setCredits(res.balance);
    haptic(30);
    push({ title: 'Échange conclu 🤝', message: `${res.card.name} rejoint votre garage`, icon: '🎴' });
    notifyAchievements(res.newAchievements, 400);
  } catch (err) {
    push({ title: 'Échange impossible', message: apiErrorMessage(err), icon: '⚠️' });
  } finally {
    busy.value = null;
    void load();
  }
}

async function cancel(o: Offer) {
  busy.value = o.id;
  try {
    await api(`/trades/${o.id}/cancel`, { method: 'POST' });
    push({ title: 'Offre retirée', message: `${o.offered.name} est de retour dans votre collection`, icon: '↩️' });
  } catch (err) {
    push({ title: 'Annulation impossible', message: apiErrorMessage(err), icon: '⚠️' });
  } finally {
    busy.value = null;
    void load();
  }
}

function onCreated() {
  creating.value = false;
  sellCardId.value = null;
  tab.value = 'mine';
  void load();
}

const timeLeft = (iso: string) => {
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));
  return h >= 24 ? `${Math.round(h / 24)} j` : `${h} h`;
};
</script>

<template>
  <div>
    <p v-if="data && !data.market.canTrade" class="market-lock">🔒 {{ data.market.reason }}</p>
    <div class="trades-head">
      <div class="subtabs">
        <button :class="{ on: tab === 'all' }" @click="tab = 'all'">Toutes</button>
        <button :class="{ on: tab === 'forme' }" @click="tab = 'forme'">Pour moi</button>
        <button :class="{ on: tab === 'mine' }" @click="tab = 'mine'">Mes offres</button>
      </div>
      <button class="btn btn-primary" @click="creating = true">+ Proposer une carte</button>
    </div>

    <div class="trades-filters">
      <input v-model="search" class="input" type="search" placeholder="Rechercher une carte proposée…" />
      <select v-model="rarity" class="select" aria-label="Rareté">
        <option value="">Toutes raretés</option>
        <option v-for="r in RARITY_ORDER" :key="r" :value="r">{{ RARITY_META[r].label }}</option>
      </select>
    </div>

    <p v-if="tab === 'forme'" class="muted hint">Les cartes qui vous manquent et que vous pouvez obtenir tout de suite.</p>
    <p v-if="tab === 'mine' && data" class="muted hint">{{ data.total }} / {{ data.openLimit }} offres ouvertes.</p>
    <p v-if="data && !offers.length" class="muted empty">Aucune offre pour le moment.</p>

    <div class="offers">
      <article v-for="o in offers" :key="o.id" class="panel trade">
        <button class="trade__card" @click="selected = o.offered.id">
          <CarCard :card="o.offered" size="sm" :interactive="false" />
          <span v-if="!o.mine && !o.offered.quantity" class="trade__new">Vous ne l’avez pas</span>
        </button>
        <div class="trade__mid">
          <span class="trade__arrow">⇄</span>
          <div v-if="o.price !== null" class="trade__price">🪙 {{ formatNumber(o.price) }}</div>
          <small class="muted">
            <template v-if="o.mine">Votre offre</template>
            <template v-else>par {{ o.seller }}<BotBadge v-if="o.sellerIsBot" /></template>
          </small>
          <small class="muted">expire dans {{ timeLeft(o.expiresAt) }}</small>
          <button v-if="o.mine" class="btn" :disabled="busy === o.id" @click="cancel(o)">Retirer</button>
          <button v-else class="btn btn-primary" :disabled="!o.canAccept || busy === o.id" @click="accept(o)">
            {{ o.canAccept ? 'Accepter' : o.wanted ? 'Carte requise' : 'Crédits insuffisants' }}
          </button>
        </div>
        <button v-if="o.wanted" class="trade__card" @click="selected = o.wanted.id">
          <CarCard :card="o.wanted" size="sm" :interactive="false" :locked="!o.mine && !o.wanted.quantity" />
          <span v-if="!o.mine && o.wanted.quantity" class="trade__have">Vous l’avez ×{{ o.wanted.quantity }}</span>
        </button>
        <div v-else class="trade__coins">🪙</div>
      </article>
    </div>

    <div v-if="data && data.page < data.pages" class="more">
      <button class="btn" @click="load(data.page + 1)">Voir plus</button>
    </div>

    <MarketTradeCreate v-if="creating" :initial-card-id="sellCardId" :price-floor="data?.market.priceFloor" @close="creating = false" @created="onCreated" />
    <CardModal v-if="selected !== null" :card-id="selected" @close="selected = null" />
  </div>
</template>

<style scoped>
.trades-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.subtabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.subtabs button {
  border: none;
  background: none;
  color: var(--muted);
  font: 600 0.9rem var(--font-body);
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
}

.subtabs button.on {
  background: var(--surface-2);
  color: var(--text);
}

.trades-filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.hint,
.empty {
  margin: 4px 0 14px;
}

.empty {
  text-align: center;
  padding: 30px 0;
}

.offers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}

@media (max-width: 520px) {
  .offers {
    grid-template-columns: 1fr;
  }
}

.trade {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 12px;
}

.trade__card {
  all: unset;
  position: relative;
  cursor: pointer;
  display: grid;
  justify-items: center;
}

.trade__new,
.trade__have {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.trade__new {
  background: var(--accent);
}

.trade__have {
  background: var(--success);
  color: #111;
}

.trade__mid {
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
  min-width: 96px;
}

.trade__mid .btn {
  margin-top: 6px;
  padding: 8px 12px;
  font-size: 0.85rem;
}

.trade__arrow {
  font-size: 1.5rem;
  color: var(--accent-2);
}

.trade__price {
  font: 1.15rem var(--font-display);
}

.trade__coins {
  display: grid;
  place-items: center;
  aspect-ratio: 63 / 88;
  font-size: 3rem;
  border-radius: 12px;
  border: 2px dashed var(--border);
}

.more {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.market-lock {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 196, 0, 0.1);
  border: 1px solid rgba(255, 196, 0, 0.35);
  color: #ffd76a;
  font-size: 0.9rem;
}
</style>
