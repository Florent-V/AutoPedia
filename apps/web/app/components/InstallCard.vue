<script setup lang="ts">
/** Invite à installer l'application (PWA) sur mobile. Masquable. */
const { canInstall, isStandalone, isIos, install } = usePwa();
const dismissed = ref(true);
const showIosHelp = ref(false);

onMounted(() => {
  try {
    dismissed.value = localStorage.getItem('garage-install-dismissed') === '1';
  } catch {
    dismissed.value = false;
  }
});

function dismiss() {
  dismissed.value = true;
  try {
    localStorage.setItem('garage-install-dismissed', '1');
  } catch {
    /* stockage indisponible */
  }
}

const visible = computed(() => !dismissed.value && !isStandalone.value && (canInstall.value || isIos.value));

async function onInstall() {
  if (canInstall.value) await install();
  else showIosHelp.value = !showIosHelp.value;
}
</script>

<template>
  <div v-if="visible" class="install panel">
    <AppLogo :show-text="false" class="install__logo" />
    <div class="install__text">
      <strong>Installez Garage</strong>
      <small v-if="!showIosHelp">Plein écran, accès direct et notifications quand vos boosters sont prêts.</small>
      <small v-else>Touchez <b>Partager</b> <span aria-hidden="true">⎋</span> puis <b>Sur l’écran d’accueil</b>.</small>
    </div>
    <button class="btn btn-primary" @click="onInstall">{{ canInstall ? 'Installer' : 'Comment ?' }}</button>
    <button class="install__close" aria-label="Masquer" @click="dismiss">✕</button>
  </div>
</template>

<style scoped>
.install {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 36px 12px 14px;
  margin-bottom: 20px;
}

.install__logo {
  font-size: 2rem;
}

.install__text {
  flex: 1;
  display: grid;
  gap: 2px;
}

.install__text small {
  color: var(--muted);
}

.install .btn {
  padding: 9px 14px;
}

.install__close {
  position: absolute;
  top: 6px;
  right: 8px;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
}
</style>
