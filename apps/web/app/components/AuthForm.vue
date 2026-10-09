<script setup lang="ts">
const props = defineProps<{ mode: 'login' | 'register' }>();
const route = useRoute();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    const client = useAuthClient();
    const res =
      props.mode === 'register'
        ? await client.signUp.email({ name: name.value.trim(), email: email.value.trim(), password: password.value })
        : await client.signIn.email({ email: email.value.trim(), password: password.value });
    if (res.error) {
      error.value = translate(res.error.code, res.error.message);
      return;
    }
    await loadSession(true);
    await refreshPlayer();
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/boosters';
    await navigateTo(redirect);
  } catch {
    error.value = 'Impossible de joindre le serveur';
  } finally {
    loading.value = false;
  }
}

function translate(code?: string, fallback?: string) {
  const messages: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: 'Email ou mot de passe incorrect',
    USER_ALREADY_EXISTS: 'Un compte existe déjà avec cet email',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Un compte existe déjà avec cet email',
    PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 8 caractères',
    PASSWORD_TOO_LONG: 'Le mot de passe est trop long',
    INVALID_EMAIL: 'Adresse email invalide',
  };
  return (code && messages[code]) || fallback || 'Une erreur est survenue';
}
</script>

<template>
  <div class="container page auth">
    <form class="panel auth__box" @submit.prevent="submit">
      <h1>{{ mode === 'register' ? 'Créer un compte' : 'Connexion' }}</h1>
      <p class="muted">
        {{ mode === 'register' ? '10 boosters vous attendent pour démarrer votre collection.' : 'Vos boosters se sont peut-être rechargés…' }}
      </p>

      <div v-if="mode === 'register'" class="field">
        <label for="name">Pseudo</label>
        <input id="name" v-model="name" class="input" required minlength="2" maxlength="32" autocomplete="nickname" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" class="input" type="email" required autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Mot de passe</label>
        <input
          id="password"
          v-model="password"
          class="input"
          type="password"
          required
          minlength="8"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary btn-lg auth__submit" :disabled="loading">
        {{ loading ? '…' : mode === 'register' ? 'Créer mon compte' : 'Se connecter' }}
      </button>

      <p class="muted auth__switch">
        <template v-if="mode === 'register'">Déjà inscrit ? <NuxtLink to="/login">Se connecter</NuxtLink></template>
        <template v-else>Pas encore de compte ? <NuxtLink to="/register">Créer un compte</NuxtLink></template>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 64px);
}

.auth__box {
  width: min(420px, 100%);
}

.auth__submit {
  width: 100%;
}

.auth__switch {
  text-align: center;
  margin-bottom: 0;
}
</style>
