<script setup lang="ts">
const data = ref<{ unlocked: number; total: number; achievements: Achievement[] } | null>(null);

const groups = computed(() => {
  const map = new Map<string, Achievement[]>();
  for (const a of data.value?.achievements ?? []) map.set(a.category, [...(map.get(a.category) ?? []), a]);
  return [...map];
});

onMounted(async () => {
  data.value = await api('/achievements');
});
</script>

<template>
  <div class="container page">
    <div class="page-head">
      <div>
        <h1>Succès & badges</h1>
        <p v-if="data">{{ data.unlocked }} / {{ data.total }} badges débloqués</p>
      </div>
    </div>

    <section v-for="[category, list] in groups" :key="category" class="group">
      <h2>{{ category }}</h2>
      <div class="group__grid">
        <AchievementBadge v-for="a in list" :key="a.id" :achievement="a" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.group {
  margin-bottom: 32px;
}

.group h2 {
  font-size: 1.3rem;
}

.group__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
</style>
