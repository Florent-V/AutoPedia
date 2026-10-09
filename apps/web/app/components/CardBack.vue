<script setup lang="ts">
defineProps<{ glow?: Rarity | null }>();

// Graduations du compte-tours (de 135° à 405°)
const ticks = Array.from({ length: 28 }, (_, i) => {
  const a = ((135 + (270 / 27) * i) * Math.PI) / 180;
  const major = i % 3 === 0;
  const r1 = major ? 31 : 34;
  return {
    x1: 50 + Math.cos(a) * r1,
    y1: 50 + Math.sin(a) * r1,
    x2: 50 + Math.cos(a) * 38,
    y2: 50 + Math.sin(a) * 38,
    major,
    red: i >= 22,
  };
});
</script>

<template>
  <div class="card-back-wrap">
    <div class="card-back" :class="glow ? `glow-${glow.toLowerCase()}` : ''">
      <div class="card-back__inner">
        <div class="card-back__rings" />
        <svg class="card-back__emblem" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" class="ring" />
          <circle cx="50" cy="50" r="40" class="ring ring--thin" />
          <line
            v-for="(t, i) in ticks"
            :key="i"
            :x1="t.x1"
            :y1="t.y1"
            :x2="t.x2"
            :y2="t.y2"
            :class="['tick', { major: t.major, red: t.red }]"
          />
          <path d="M50 50 L72 33" class="needle" />
          <circle cx="50" cy="50" r="4" class="hub" />
          <path d="M38 70 L62 70" class="bar" />
          <path d="M42 75 L58 75" class="bar bar--thin" />
        </svg>
        <div class="card-back__sheen" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-back-wrap {
  width: 100%;
  container-type: inline-size;
}

.card-back {
  --g: transparent;
  --edge: #8b97b0;
  width: 100%;
  aspect-ratio: 63 / 88;
  border-radius: 4.5cqw;
  padding: 1.6cqw;
  background: conic-gradient(from 210deg, #3a4560, var(--edge), #1a2133, #3a4560, var(--accent), #3a4560);
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.5),
    0 0 26px var(--g);
}

.card-back__inner {
  position: relative;
  height: 100%;
  border-radius: 3.4cqw;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(70% 50% at 50% 45%, rgba(255, 61, 61, 0.16), transparent 70%),
    repeating-linear-gradient(60deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 2.4cqw),
    repeating-linear-gradient(-60deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 2.4cqw),
    linear-gradient(180deg, #121826, #070a11);
}

.card-back__rings {
  position: absolute;
  inset: 5cqw;
  border-radius: 2.4cqw;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 0 0 3cqw transparent,
    inset 0 0 0 calc(3cqw + 1px) rgba(255, 255, 255, 0.05);
}

.card-back__emblem {
  position: relative;
  width: 62cqw;
  filter: drop-shadow(0 0 3cqw rgba(255, 61, 61, 0.35));
}

.ring {
  fill: rgba(255, 255, 255, 0.02);
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 1.2;
}

.ring--thin {
  fill: none;
  stroke-width: 0.5;
  stroke: rgba(255, 255, 255, 0.25);
}

.tick {
  stroke: rgba(255, 255, 255, 0.45);
  stroke-width: 0.8;
  stroke-linecap: round;
}

.tick.major {
  stroke: #fff;
  stroke-width: 1.6;
}

.tick.red {
  stroke: var(--accent);
}

.needle {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-linecap: round;
}

.hub {
  fill: #0b0f17;
  stroke: #fff;
  stroke-width: 1.4;
}

.bar {
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 1.6;
  stroke-linecap: round;
}

.bar--thin {
  stroke-width: 0.8;
  stroke: rgba(255, 255, 255, 0.35);
}

.card-back__sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.12) 48%, transparent 60%);
  background-size: 250% 100%;
  animation: sheen 4s ease-in-out infinite;
  pointer-events: none;
}

.glow-rare {
  --g: var(--r-rare);
  --edge: var(--r-rare);
}
.glow-epic {
  --g: var(--r-epic);
  --edge: var(--r-epic);
  animation: pulse 1.2s ease-in-out infinite;
}
.glow-legendary {
  --g: var(--r-legendary);
  --edge: var(--r-legendary);
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes sheen {
  0%,
  100% {
    background-position: 120% 0;
  }
  50% {
    background-position: -20% 0;
  }
}

@keyframes pulse {
  50% {
    box-shadow:
      0 14px 30px rgba(0, 0, 0, 0.5),
      0 0 50px var(--g),
      0 0 90px var(--g);
  }
}
</style>
