<script setup lang="ts">
interface Party {
  name: string;
  isBot: boolean;
}
interface AuctionItem {
  id: string;
  card: Card;
  startPrice: number;
  currentBid: number | null;
  minBid: number;
  bidCount: number;
  endsAt: string;
  seller: Party;
  bidder: Party | null;
  mine: boolean;
  leading: boolean;
}
interface Page {
  page: number;
  pages: number;
  total: number;
  balance: number;
  feePercent: number;
  durations: number[];
  openLimit: number;
  market: { canTrade: boolean; reason: string | null; priceFloor: Record<Rarity, number>; maxSwapRarityGap: number };
  auctions: AuctionItem[];
}

const route = useRoute();
const tab = ref<'all' | 'selling' | 'bidding'>('all');
const search = ref('');
const rarity = ref('');
const data = ref<Page | null>(null);
const items = ref<AuctionItem[]>([]);
const amounts = reactive<Record<string, number>>({});
const busy = ref<string | null>(null);
const creating = ref(false);
const sellCardId = ref<number | null>(null);
const selected = ref<number | null>(null);
const now = ref(Date.now());
const { push } = useToasts();
let clock: ReturnType<typeof setInterval> | undefined;
let poll: ReturnType<typeof setInterval> | undefined;

async function load(page = 1) {
  const query: Record<string, string | number> = { tab: tab.value, page };
  if (search.value) query.search = search.value;
  if (rarity.value) query.rarity = rarity.value;
  const res = await api<Page>('/auctions', { query });
  data.value = res;
  items.value = page === 1 ? res.auctions : [...items.value, ...res.auctions];
  for (const a of res.auctions) if (!amounts[a.id] || amounts[a.id]! < a.minBid) amounts[a.id] = a.minBid;
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
  clock = setInterval(() => (now.value = Date.now()), 1000);
  // Les offres des autres joueurs (et des bots) arrivent en continu.
  poll = setInterval(() => void load(), 15_000);
});
onBeforeUnmount(() => {
  clearInterval(clock);
  clearInterval(poll);
});

async function bid(a: AuctionItem) {
  const amount = Math.round(amounts[a.id] ?? a.minBid);
  busy.value = a.id;
  try {
    const res = await api<{ balance: number }>(`/auctions/${a.id}/bid`, { method: 'POST', body: { amount } });
    setCredits(res.balance);
    haptic(25);
    push({ title: 'Offre enregistrée 🔨', message: `${formatNumber(amount)} crédits sur « ${a.card.name} ». Ils vous seront rendus si quelqu’un surenchérit.`, icon: '✋' });
  } catch (err) {
    push({ title: 'Offre refusée', message: apiErrorMessage(err), icon: '⚠️' });
  } finally {
    busy.value = null;
    void load();
  }
}

async function cancel(a: AuctionItem) {
  busy.value = a.id;
  try {
    await api(`/auctions/${a.id}/cancel`, { method: 'POST' });
    push({ title: 'Enchère annulée', message: `${a.card.name} est de retour dans votre collection`, icon: '↩️' });
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
  tab.value = 'selling';
  void load();
}

const left = (a: AuctionItem) => Math.max(0, new Date(a.endsAt).getTime() - now.value);
</script>

<template>
  <div>
    <p v-if="data && !data.market.canTrade" class="market-lock">🔒 {{ data.market.reason }}</p>
    <div class="head">
      <div class="subtabs">
        <button :class="{ on: tab === 'all' }" @click="tab = 'all'">En cours</button>
        <button :class="{ on: tab === 'bidding' }" @click="tab = 'bidding'">Mes offres</button>
        <button :class="{ on: tab === 'selling' }" @click="tab = 'selling'">Mes ventes</button>
      </div>
      <button class="btn btn-primary" @click="creating = true">+ Mettre aux enchères</button>
    </div>

    <div class="filters">
      <input v-model="search" class="input" type="search" placeholder="Rechercher une carte…" />
      <select v-model="rarity" class="select" aria-label="Rareté">
        <option value="">Toutes raretés</option>
        <option v-for="r in RARITY_ORDER" :key="r" :value="r">{{ RARITY_META[r].label }}</option>
      </select>
    </div>

    <p v-if="data && !items.length" class="muted empty">Aucune enchère pour le moment.</p>

    <div class="grid">
      <article v-for="a in items" :key="a.id" class="panel auction" :class="{ leading: a.leading, soon: left(a) < 5 * 60_000 }">
        <button class="auction__card" @click="selected = a.card.id">
          <CarCard :card="a.card" size="sm" :interactive="false" />
          <span v-if="!a.mine && !a.card.quantity" class="tag tag--new">Vous ne l’avez pas</span>
        </button>
        <div class="auction__info">
          <div class="auction__time">⏱ {{ formatDuration(left(a)) }}</div>
          <div class="auction__price">
            🪙 {{ formatNumber(a.currentBid ?? a.startPrice) }}
            <small class="muted">{{ a.currentBid ? `${a.bidCount} offre${a.bidCount > 1 ? 's' : ''}` : 'mise à prix' }}</small>
          </div>
          <small class="muted">
            <template v-if="a.bidder">Meilleure offre : {{ a.leading ? 'vous' : a.bidder.name }}<BotBadge v-if="a.bidder.isBot && !a.leading" /></template>
            <template v-else>Aucune offre</template>
          </small>
          <small class="muted">Vendeur : {{ a.mine ? 'vous' : a.seller.name }}<BotBadge v-if="a.seller.isBot && !a.mine" /></small>

          <template v-if="a.mine">
            <button v-if="!a.bidCount" class="btn" :disabled="busy === a.id" @click="cancel(a)">Annuler</button>
            <span v-else class="chip">En cours de vente</span>
          </template>
          <span v-else-if="a.leading" class="chip chip--lead">✓ Vous menez</span>
          <div v-else class="auction__bid">
            <input v-model.number="amounts[a.id]" class="input" type="number" :min="a.minBid" inputmode="numeric" aria-label="Montant" />
            <button class="btn btn-primary" :disabled="busy === a.id || (amounts[a.id] ?? 0) < a.minBid || (data?.balance ?? 0) < (amounts[a.id] ?? 0)" @click="bid(a)">
              {{ (data?.balance ?? 0) < (amounts[a.id] ?? a.minBid) ? 'Crédits insuffisants' : 'Enchérir' }}
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="data && data.page < data.pages" class="more">
      <button class="btn" @click="load(data.page + 1)">Voir plus</button>
    </div>

    <MarketAuctionCreate
      v-if="creating && data"
      :initial-card-id="sellCardId"
      :durations="data.durations"
      :fee-percent="data.feePercent"
      :price-floor="data.market.priceFloor"
      @close="creating = false"
      @created="onCreated"
    />
    <CardModal v-if="selected !== null" :card-id="selected" @close="selected = null" />
  </div>
</template>

<style scoped>
.head {
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

.filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.empty {
  text-align: center;
  padding: 30px 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

@media (max-width: 520px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.auction {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 14px;
  padding: 12px;
  align-items: center;
}

.auction.leading {
  border-color: var(--success);
}

.auction__card {
  all: unset;
  position: relative;
  cursor: pointer;
  display: grid;
}

.tag {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.tag--new {
  background: var(--accent);
}

.auction__info {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.auction__time {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.soon .auction__time {
  color: var(--danger);
}

.auction__price {
  font: 1.35rem var(--font-display);
}

.auction__price small {
  font: 500 0.8rem var(--font-body);
}

.auction__bid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  margin-top: 4px;
}

.auction__bid .input {
  padding: 9px 10px;
  min-width: 0;
}

.auction__bid .btn {
  padding: 9px 14px;
}

.chip--lead {
  color: var(--success);
  border-color: var(--success);
  justify-self: start;
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
