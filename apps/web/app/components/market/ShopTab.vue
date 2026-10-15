<script setup lang="ts">
interface Offer {
  offerKey: string;
  price: number;
  basePrice: number;
  deal: boolean;
  endsAt: string;
  purchased: boolean;
  card: Card;
}
interface Shop {
  date: string;
  hour: number;
  balance: number;
  nextRotationAt: string;
  offers: Offer[];
}

const shop = ref<Shop | null>(null);
const busy = ref<string | null>(null);
const selected = ref<number | null>(null);
const now = ref(Date.now());
const { push } = useToasts();
let timer: ReturnType<typeof setInterval> | undefined;

async function load() {
  shop.value = await api<Shop>('/shop');
  setCredits(shop.value.balance);
}

onMounted(() => {
  void load();
  timer = setInterval(() => {
    now.value = Date.now();
    if (shop.value && new Date(shop.value.nextRotationAt).getTime() <= now.value) void load();
  }, 1000);
});
onBeforeUnmount(() => clearInterval(timer));

const groups = computed(() =>
  [...RARITY_ORDER].reverse()
    .map((r) => ({ rarity: r, offers: shop.value?.offers.filter((o) => o.card.rarity === r) ?? [] }))
    .filter((g) => g.offers.length),
);

async function buy(o: Offer) {
  busy.value = o.offerKey;
  try {
    const res = await api<{ card: Card; balance: number; newAchievements: Achievement[] }>('/shop/buy', {
      method: 'POST',
      body: { offerKey: o.offerKey },
    });
    o.purchased = true;
    o.card.quantity = res.card.quantity;
    if (shop.value) shop.value.balance = res.balance;
    setCredits(res.balance);
    haptic(30);
    push({ title: `${res.card.name} rejoint votre garage`, message: res.card.isNew ? 'Nouvelle carte !' : `${res.card.quantity} exemplaires`, icon: '🛒' });
    notifyAchievements(res.newAchievements, 400);
  } catch (err) {
    push({ title: 'Achat impossible', message: apiErrorMessage(err), icon: '⚠️' });
    void load();
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div v-if="shop">
    <div class="shop-head panel">
      <div>
        <strong>Rotation dans {{ formatDuration(new Date(shop.nextRotationAt).getTime() - now) }}</strong>
        <small class="muted">De nouvelles cartes chaque heure · un exemplaire par offre et par joueur</small>
      </div>
      <span class="chip">🪙 {{ formatNumber(shop.balance) }}</span>
    </div>

    <section v-for="g in groups" :key="g.rarity" class="shop-group">
      <h3 :class="`r-${g.rarity.toLowerCase()}`">{{ RARITY_META[g.rarity].label }}</h3>
      <div class="shop-grid">
        <div v-for="o in g.offers" :key="o.offerKey" class="offer" :class="{ deal: o.deal }">
          <span v-if="o.deal" class="offer__deal">Affaire de l’heure −25 %</span>
          <button class="offer__card" @click="selected = o.card.id">
            <CarCard :card="o.card" size="sm" :interactive="false" />
          </button>
          <small v-if="g.rarity === 'LEGENDARY' || g.rarity === 'EPIC'" class="muted offer__until">
            Jusqu’à {{ new Date(o.endsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
          </small>
          <button
            class="btn"
            :class="{ 'btn-primary': !o.purchased && shop.balance >= o.price }"
            :disabled="o.purchased || shop.balance < o.price || busy === o.offerKey"
            @click="buy(o)"
          >
            <template v-if="o.purchased">Acheté ✓</template>
            <template v-else>
              <s v-if="o.deal" class="offer__old">{{ o.basePrice }}</s> 🪙 {{ formatNumber(o.price) }}
            </template>
          </button>
        </div>
      </div>
    </section>

    <CardModal v-if="selected !== null" :card-id="selected" @close="selected = null" />
  </div>
</template>

<style scoped>
.shop-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  margin-bottom: 20px;
  font-variant-numeric: tabular-nums;
}

.shop-head strong,
.shop-head small {
  display: block;
}

.shop-group h3 {
  font-size: 1.05rem;
  margin: 18px 0 10px;
}

.r-common { color: var(--r-common); }
.r-uncommon { color: var(--r-uncommon); }
.r-rare { color: var(--r-rare); }
.r-epic { color: var(--r-epic); }
.r-legendary { color: var(--r-legendary); }

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

@media (max-width: 520px) {
  .shop-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

.offer {
  position: relative;
  display: grid;
  gap: 8px;
  justify-items: center;
}

.offer .btn {
  width: 100%;
  padding: 9px 10px;
  font-variant-numeric: tabular-nums;
}

.offer__card {
  all: unset;
  cursor: pointer;
  width: 100%;
  display: flex;
  justify-content: center;
}

.offer__deal {
  position: absolute;
  z-index: 3;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--accent-2);
  color: #111;
  box-shadow: 0 0 12px rgba(255, 176, 32, 0.6);
}

.offer__old {
  opacity: 0.6;
  margin-right: 4px;
}

.offer__until {
  font-size: 0.75rem;
}
</style>
