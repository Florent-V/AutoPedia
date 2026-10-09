<script setup lang="ts">
const { toasts, dismiss } = useToasts();
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <button v-for="t in toasts" :key="t.id" class="toast" :class="t.tier" @click="dismiss(t.id)">
        <span v-if="t.icon" class="toast__icon">{{ t.icon }}</span>
        <span>
          <strong>{{ t.title }}</strong>
          <small v-if="t.message">{{ t.message }}</small>
        </span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  display: grid;
  gap: 10px;
  max-width: min(360px, calc(100vw - 32px));
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
  cursor: pointer;
  font: inherit;
}

.toast strong,
.toast small {
  display: block;
}

.toast small {
  color: var(--muted);
}

.toast__icon {
  font-size: 1.8rem;
}

.toast.gold,
.toast.platinum {
  border-color: var(--r-legendary);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
