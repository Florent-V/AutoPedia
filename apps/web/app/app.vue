<template>
  <div>
    <AppHeader />
    <main class="app-main" :class="{ 'with-tabs': session }">
      <NuxtPage />
    </main>
    <BottomNav v-if="session" />
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
const session = useSessionState();
</script>
