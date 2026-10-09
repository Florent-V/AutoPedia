<script setup lang="ts">
defineProps<{ glow?: Rarity | null }>();
</script>

<template>
  <div class="card-back-wrap">
  <div class="card-back" :class="glow ? `glow-${glow.toLowerCase()}` : ''">
    <div class="card-back__inner">
      <div class="card-back__logo">
        <span>Auto</span><span>Pedia</span>
      </div>
      <CarSilhouette class="card-back__car" />
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
  width: 100%;
  aspect-ratio: 63 / 88;
  border-radius: 4.5cqw;
  padding: 3.2cqw;
  background: linear-gradient(145deg, #ff3d3d, #8a1020 50%, #ff3d3d);
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.45),
    0 0 26px var(--g);
}

.card-back__inner {
  position: relative;
  height: 100%;
  border-radius: 3cqw;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 6cqw;
  overflow: hidden;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 6px, transparent 6px 14px),
    radial-gradient(circle at 50% 40%, #2a1420, #0b0f17 75%);
}

.card-back__logo {
  font-family: var(--font-display);
  font-size: 12cqw;
  line-height: 1;
  text-align: center;
  transform: rotate(-8deg);
}

.card-back__logo span:first-child {
  color: #fff;
}

.card-back__logo span:last-child {
  color: var(--accent-2);
}

.card-back__car {
  width: 60cqw;
  color: rgba(255, 255, 255, 0.12);
}

.glow-rare {
  --g: var(--r-rare);
}
.glow-epic {
  --g: var(--r-epic);
  animation: pulse 1.2s ease-in-out infinite;
}
.glow-legendary {
  --g: var(--r-legendary);
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    box-shadow:
      0 14px 30px rgba(0, 0, 0, 0.45),
      0 0 50px var(--g),
      0 0 90px var(--g);
  }
}
</style>
