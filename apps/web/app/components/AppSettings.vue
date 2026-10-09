<script setup lang="ts">
const { canInstall, isStandalone, isIos, install, pushState, refreshPushState, enablePush, disablePush } = usePwa();
const { push } = useToasts();
const busy = ref(false);

onMounted(() => void refreshPushState().catch(() => undefined));

async function toggle() {
  busy.value = true;
  try {
    if (pushState.value === 'subscribed') await disablePush();
    else if (await enablePush()) push({ title: 'Notifications activées', icon: '🔔' });
  } catch (err) {
    push({ title: 'Activation impossible', message: apiErrorMessage(err, (err as Error).message), icon: '⚠️' });
  } finally {
    busy.value = false;
  }
}

async function test() {
  try {
    await api('/push/test', { method: 'POST' });
  } catch (err) {
    push({ title: 'Échec du test', message: apiErrorMessage(err), icon: '⚠️' });
  }
}

const pushLabel = computed(
  () =>
    ({
      unsupported: isIos.value && !isStandalone.value
        ? 'Sur iPhone, installez d’abord l’application sur l’écran d’accueil.'
        : 'Ce navigateur ne gère pas les notifications.',
      disabled: 'Les notifications ne sont pas configurées sur ce serveur.',
      denied: 'Notifications bloquées : autorisez-les dans les réglages du navigateur.',
      default: 'Soyez prévenu quand votre réserve de boosters est pleine.',
      granted: 'Soyez prévenu quand votre réserve de boosters est pleine.',
      subscribed: 'Activées sur cet appareil.',
    })[pushState.value],
);
</script>

<template>
  <section class="panel settings">
    <h2>Application</h2>

    <div class="row">
      <div>
        <strong>Notifications</strong>
        <small>{{ pushLabel }}</small>
      </div>
      <div class="row__actions">
        <button v-if="pushState === 'subscribed'" class="btn btn-ghost" @click="test">Tester</button>
        <button
          v-if="['default', 'granted', 'subscribed'].includes(pushState)"
          class="btn"
          :class="{ 'btn-primary': pushState !== 'subscribed' }"
          :disabled="busy"
          @click="toggle"
        >
          {{ pushState === 'subscribed' ? 'Désactiver' : 'Activer' }}
        </button>
      </div>
    </div>

    <div class="row">
      <div>
        <strong>Installation</strong>
        <small v-if="isStandalone">Garage est installé sur cet appareil. 👌</small>
        <small v-else-if="canInstall">Ajoutez Garage à votre écran d’accueil.</small>
        <small v-else-if="isIos">Dans Safari : <b>Partager</b> puis <b>Sur l’écran d’accueil</b>.</small>
        <small v-else>Utilisez le menu de votre navigateur : « Installer l’application ».</small>
      </div>
      <button v-if="canInstall && !isStandalone" class="btn btn-primary" @click="install">Installer</button>
    </div>
  </section>
</template>

<style scoped>
.settings {
  margin-top: 24px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 0;
  border-top: 1px solid var(--border);
}

.row strong,
.row small {
  display: block;
}

.row small {
  color: var(--muted);
  margin-top: 2px;
}

.row__actions {
  display: flex;
  gap: 8px;
  flex: none;
}
</style>
