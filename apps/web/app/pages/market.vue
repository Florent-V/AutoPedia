<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const tab = ref<'shop' | 'trades'>(route.query.tab === 'trades' || route.query.sell ? 'trades' : 'shop');
watch(tab, (t) => void router.replace({ query: { tab: t } }));
const player = usePlayerState();
</script>

<template>
  <div class="container page">
    <div class="page-head">
      <div>
        <h1>Marché</h1>
        <p>Dépensez vos crédits à la boutique ou échangez vos doublons avec les autres joueurs.</p>
      </div>
      <span class="chip">🪙 {{ formatNumber(player?.stats.credits ?? 0) }} crédits</span>
    </div>

    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'shop'" :class="{ on: tab === 'shop' }" @click="tab = 'shop'">🛒 Boutique</button>
      <button role="tab" :aria-selected="tab === 'trades'" :class="{ on: tab === 'trades' }" @click="tab = 'trades'">🤝 Bourse d’échanges</button>
    </div>

    <MarketShopTab v-if="tab === 'shop'" />
    <MarketTradesTab v-else />
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 5px;
  margin-bottom: 20px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  max-width: 520px;
}

.tabs button {
  border: none;
  background: none;
  color: var(--muted);
  font: 600 0.95rem var(--font-body);
  padding: 11px 10px;
  border-radius: 12px;
  cursor: pointer;
}

.tabs button.on {
  background: linear-gradient(135deg, var(--accent), #ff7a2f);
  color: #fff;
}
</style>
