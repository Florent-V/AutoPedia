<script setup lang="ts">
const session = useSessionState();

const demo: Card[] = [
  { id: 1, name: 'Citroën 2CV', manufacturer: 'Citroën', country: 'France', yearStart: 1948, yearEnd: 1990, imageUrl: null, rarity: 'RARE', points: 10, powerHp: 29, topSpeedKmh: 115, massKg: 600, wikiUrl: null },
  { id: 2, name: 'Ferrari F40', manufacturer: 'Ferrari', country: 'Italie', yearStart: 1987, yearEnd: 1992, imageUrl: null, rarity: 'LEGENDARY', points: 100, powerHp: 478, topSpeedKmh: 324, massKg: 1100, wikiUrl: null },
  { id: 3, name: 'Porsche 959', manufacturer: 'Porsche', country: 'Allemagne', yearStart: 1986, yearEnd: 1993, imageUrl: null, rarity: 'EPIC', points: 30, powerHp: 450, topSpeedKmh: 317, massKg: 1450, wikiUrl: null },
];

const steps = [
  { icon: '⏱️', title: 'Récupérez des boosters', text: 'Un nouveau booster arrive régulièrement, jusqu’à 10 en réserve. Ouvrez-les pour relancer le compteur !' },
  { icon: '🎴', title: 'Ouvrez-les', text: 'Chaque booster contient 5 cartes. La dernière est toujours au moins Peu commune.' },
  { icon: '📚', title: 'Complétez votre garage', text: 'Des milliers de modèles issus de Wikipédia, des plus courants aux plus mythiques.' },
  { icon: '🏆', title: 'Débloquez des badges', text: 'Succès, points de collection et défis par constructeur ou par époque.' },
];
</script>

<template>
  <div class="container page">
    <section class="hero">
      <div class="hero__text">
        <h1>Collectionnez <span>toute l’histoire</span> de l’automobile</h1>
        <p>
          Ouvrez des boosters, découvrez des voitures de légende et complétez votre collection.
          Chaque carte est un vrai modèle, avec son histoire tirée de Wikipédia.
        </p>
        <div class="hero__cta">
          <NuxtLink v-if="session" to="/boosters" class="btn btn-primary btn-lg">Ouvrir mes boosters</NuxtLink>
          <template v-else>
            <NuxtLink to="/register" class="btn btn-primary btn-lg">Commencer gratuitement</NuxtLink>
            <NuxtLink to="/login" class="btn btn-lg">J’ai déjà un compte</NuxtLink>
          </template>
        </div>
      </div>
      <div class="hero__cards">
        <div v-for="(c, i) in demo" :key="c.id" class="hero__card" :class="`pos-${i}`">
          <CarCard :card="c" size="md" />
        </div>
      </div>
    </section>

    <section class="steps">
      <div v-for="s in steps" :key="s.title" class="panel step">
        <span class="step__icon">{{ s.icon }}</span>
        <h3>{{ s.title }}</h3>
        <p class="muted">{{ s.text }}</p>
      </div>
    </section>

    <section class="panel rarities">
      <h2>Raretés</h2>
      <div class="rarities__list">
        <div v-for="r in RARITY_ORDER" :key="r" class="rarity" :class="`r-${r.toLowerCase()}`">
          <span class="rarity__dot" />
          <strong>{{ RARITY_META[r].label }}</strong>
          <span class="muted">{{ RARITY_META[r].points }} pts</span>
          <span v-if="RARITY_META[r].holo" class="rarity__holo">holographique</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  overflow-x: clip;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 40px;
  align-items: center;
  min-height: 70vh;
}

.hero h1 {
  font-size: clamp(2.2rem, 5vw, 3.6rem);
  line-height: 1.05;
}

.hero h1 span {
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero p {
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1.6;
  max-width: 540px;
}

.hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.hero__cards {
  position: relative;
  height: 440px;
}

.hero__card {
  position: absolute;
  width: 230px;
  top: 50%;
  left: 50%;
  transition: transform 0.3s ease;
}

.pos-0 {
  transform: translate(-115%, -48%) rotate(-12deg);
}
.pos-1 {
  transform: translate(-50%, -55%);
  z-index: 2;
}
.pos-2 {
  transform: translate(15%, -48%) rotate(12deg);
}

@media (max-width: 860px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  .hero__cards {
    height: 340px;
  }
  .hero__card {
    width: 170px;
  }
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
  margin: 40px 0;
}

.step__icon {
  font-size: 2rem;
}

.step h3 {
  margin-top: 10px;
}

.rarities__list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.rarity {
  --c: var(--r-common);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--bg-2);
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
}

.r-uncommon {
  --c: var(--r-uncommon);
}
.r-rare {
  --c: var(--r-rare);
}
.r-epic {
  --c: var(--r-epic);
}
.r-legendary {
  --c: var(--r-legendary);
}

.rarity__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 8px var(--c);
}

.rarity__holo {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff0084, #ffc400, #00ffaa, #00aaff, #aa00ff);
  color: #111;
  font-weight: 700;
}
</style>
