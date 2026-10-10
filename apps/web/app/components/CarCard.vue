<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    card: Card;
    /** Carte non possédée : affichée en silhouette. */
    locked?: boolean;
    /** Active l'inclinaison 3D et le reflet qui suit le pointeur. */
    interactive?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { locked: false, interactive: true, size: 'md' },
);

const meta = computed(() => RARITY_META[props.card.rarity]);
const rarityClass = computed(() => `r-${props.card.rarity.toLowerCase()}`);
const years = computed(() => formatYears(props.card));
const imageFailed = ref(false);
const showImage = computed(() => !props.locked && !!props.card.imageUrl && !imageFailed.value);

const el = ref<HTMLElement | null>(null);
const pointer = reactive({ x: 50, y: 50, active: false });

function onMove(e: PointerEvent) {
  if (!props.interactive || !el.value) return;
  const rect = el.value.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 100;
  pointer.y = ((e.clientY - rect.top) / rect.height) * 100;
  pointer.active = true;
}

function onLeave() {
  pointer.active = false;
  pointer.x = 50;
  pointer.y = 50;
}

const style = computed(() => {
  const rx = pointer.active ? (50 - pointer.y) / 3.5 : 0;
  const ry = pointer.active ? (pointer.x - 50) / 3.5 : 0;
  return {
    '--mx': `${pointer.x}%`,
    '--my': `${pointer.y}%`,
    '--rx': `${rx}deg`,
    '--ry': `${ry}deg`,
    '--hyp': `${Math.min(1, Math.hypot(pointer.x - 50, pointer.y - 50) / 50)}`,
  };
});

/** Trois caractéristiques affichées : les premières disponibles, dans cet ordre de préférence. */
const stats = computed(() => {
  const all = [
    { label: 'ch', value: props.card.powerHp ? formatNumber(props.card.powerHp) : null },
    { label: 'km/h', value: props.card.topSpeedKmh ? formatNumber(props.card.topSpeedKmh) : null },
    { label: 'kg', value: props.card.massKg ? formatNumber(props.card.massKg) : null },
    {
      label: 'm',
      value: props.card.lengthMm ? (props.card.lengthMm / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : null,
    },
  ];
  const known = all.filter((s) => s.value);
  return [...known, ...all.filter((s) => !s.value)].slice(0, 3);
});
</script>

<template>
  <div
    ref="el"
    class="car-card"
    :class="[rarityClass, `size-${size}`, { locked, holo: meta.holo && !locked, active: pointer.active }]"
    :style="style"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <div class="car-card__body">
      <div class="car-card__frame">
        <header class="car-card__head">
          <span class="car-card__name" :title="card.name">{{ card.name }}</span>
          <span class="car-card__gem" :title="meta.label">{{ meta.short }}</span>
        </header>

        <div class="car-card__art">
          <img
            v-if="showImage"
            :src="card.imageUrl!"
            :alt="card.name"
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="imageFailed = true"
          />
          <div v-else class="car-card__placeholder">
            <span class="car-card__ref">N° {{ String(card.id).padStart(4, '0') }}</span>
            <CarLineArt :year="card.yearStart" />
            <span v-if="!locked && card.manufacturer" class="car-card__mono">{{ card.manufacturer }}</span>
          </div>
          <span v-if="card.quantity && card.quantity > 1" class="car-card__qty">×{{ card.quantity }}</span>
          <span v-if="card.isNew" class="car-card__new">Nouveau</span>
          <span v-if="card.racing" class="car-card__race" title="Voiture de course">🏁</span>
        </div>

        <div class="car-card__info">
          <span class="car-card__brand">{{ card.manufacturer || '—' }}</span>
          <span class="car-card__meta">
            <template v-if="card.country">{{ card.country }}</template>
            <template v-if="card.country && years"> · </template>
            {{ years }}
          </span>
        </div>

        <ul v-if="size !== 'sm'" class="car-card__stats">
          <li v-for="s in stats" :key="s.label">
            <strong>{{ locked || !s.value ? '—' : s.value }}</strong>
            <span>{{ s.label }}</span>
          </li>
        </ul>

        <footer class="car-card__foot">
          <span>{{ meta.label }}</span>
          <span class="car-card__pts">{{ card.points }} pts</span>
        </footer>
      </div>
      <div class="car-card__shine" />
      <div class="car-card__glare" />
    </div>
  </div>
</template>

<style scoped>
.car-card {
  --c: var(--r-common);
  --c2: #5d6677;
  --bg-a: #2a303c;
  --bg-b: #161a22;
  width: 100%;
  aspect-ratio: 63 / 88;
  perspective: 900px;
  container-type: inline-size;
  user-select: none;
}

.size-sm {
  max-width: 220px;
}
.size-md {
  max-width: 260px;
}
.size-lg {
  max-width: 360px;
}

.r-uncommon {
  --c: var(--r-uncommon);
  --c2: #137a56;
  --bg-a: #12382c;
  --bg-b: #0b1d17;
}
.r-rare {
  --c: var(--r-rare);
  --c2: #1757a8;
  --bg-a: #11305a;
  --bg-b: #0a1628;
}
.r-epic {
  --c: var(--r-epic);
  --c2: #6420b0;
  --bg-a: #3a1462;
  --bg-b: #170a2a;
}
.r-legendary {
  --c: var(--r-legendary);
  --c2: #c4720a;
  --bg-a: #5a3a06;
  --bg-b: #221303;
}

.car-card__body {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 4.5cqw;
  padding: 3.2cqw;
  background: linear-gradient(145deg, var(--c), var(--c2) 45%, var(--c) 70%, var(--c2));
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 14px 30px rgba(0, 0, 0, 0.45);
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition:
    transform 0.25s ease-out,
    box-shadow 0.25s ease;
  overflow: hidden;
}

.active .car-card__body {
  transition: transform 0.05s linear;
}

.r-epic .car-card__body,
.r-legendary .car-card__body {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.15) inset,
    0 0 24px color-mix(in srgb, var(--c) 55%, transparent),
    0 14px 30px rgba(0, 0, 0, 0.45);
}

.car-card__frame {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 3cqw;
  padding: 3cqw;
  gap: 2.4cqw;
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--c) 35%, transparent), transparent 70%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0 2px, transparent 2px 9px),
    linear-gradient(180deg, var(--bg-a), var(--bg-b));
  color: #fff;
  z-index: 1;
}

.car-card__head {
  display: flex;
  align-items: center;
  gap: 2cqw;
}

.car-card__name {
  flex: 1;
  font-family: var(--font-display);
  font-size: 7.4cqw;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.car-card__gem {
  flex: none;
  display: grid;
  place-items: center;
  min-width: 11cqw;
  height: 11cqw;
  padding: 0 1.5cqw;
  border-radius: 999px;
  font: 700 4.6cqw var(--font-body);
  color: #111;
  background: radial-gradient(circle at 30% 30%, #fff, var(--c) 55%, var(--c2));
  box-shadow: 0 0 8px color-mix(in srgb, var(--c) 70%, transparent);
}

.car-card__art {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 2cqw;
  overflow: hidden;
  border: 0.8cqw solid color-mix(in srgb, var(--c) 70%, #000);
  background:
    radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--c) 45%, transparent), transparent 70%),
    linear-gradient(180deg, #e9eef6, #b9c3d3);
}

.car-card__art:has(.car-card__placeholder) {
  background:
    radial-gradient(90% 70% at 50% 100%, color-mix(in srgb, var(--c) 35%, transparent), transparent 70%),
    linear-gradient(color-mix(in srgb, var(--c) 14%, transparent) 1px, transparent 1px) 0 0 / 6cqw 6cqw,
    linear-gradient(90deg, color-mix(in srgb, var(--c) 14%, transparent) 1px, transparent 1px) 0 0 / 6cqw 6cqw,
    linear-gradient(180deg, #0d1422, #070b13);
}

.car-card__art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.car-card__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 3cqw;
  padding: 6cqw;
  color: color-mix(in srgb, var(--c) 85%, #fff);
}

.car-card__placeholder :deep(svg) {
  width: 72cqw;
  filter: drop-shadow(0 0 2cqw color-mix(in srgb, var(--c) 60%, transparent));
}

.car-card__ref {
  position: absolute;
  left: 3cqw;
  bottom: 2.4cqw;
  font: 600 3.4cqw ui-monospace, 'SFMono-Regular', Menlo, monospace;
  letter-spacing: 0.08em;
  opacity: 0.6;
}

.car-card__mono {
  font: 600 3.8cqw ui-monospace, 'SFMono-Regular', Menlo, monospace;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  opacity: 0.75;
}

.car-card__qty,
.car-card__new {
  position: absolute;
  top: 2cqw;
  padding: 0.8cqw 2.6cqw;
  border-radius: 999px;
  font: 700 4.2cqw var(--font-body);
}

.car-card__race {
  position: absolute;
  left: 2cqw;
  bottom: 2cqw;
  padding: 0.6cqw 1.8cqw;
  border-radius: 999px;
  font-size: 4.4cqw;
  background: rgba(0, 0, 0, 0.65);
}

.car-card__qty {
  right: 2cqw;
  background: rgba(0, 0, 0, 0.7);
}

.car-card__new {
  left: 2cqw;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(255, 61, 61, 0.7);
  text-transform: uppercase;
}

.car-card__info {
  display: grid;
  gap: 0.5cqw;
}

.car-card__brand {
  font: 700 5.2cqw var(--font-body);
  color: var(--c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.car-card__meta {
  font-size: 4.4cqw;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.car-card__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5cqw;
  list-style: none;
  margin: 0;
  padding: 0;
}

.car-card__stats li {
  display: grid;
  justify-items: center;
  padding: 1.4cqw 0;
  border-radius: 1.6cqw;
  background: rgba(0, 0, 0, 0.3);
}

.car-card__stats strong {
  font-size: 4.8cqw;
}

.car-card__stats span {
  font-size: 3.4cqw;
  opacity: 0.7;
}

.car-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font: 600 3.9cqw var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.9;
}

.car-card__pts {
  color: var(--c);
}

/* Effet holographique (Épique / Légendaire) */
.car-card__shine,
.car-card__glare {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
}

.holo .car-card__shine {
  background:
    repeating-linear-gradient(
      110deg,
      rgba(255, 0, 132, 0.55) 0%,
      rgba(255, 196, 0, 0.55) 7%,
      rgba(0, 255, 170, 0.55) 14%,
      rgba(0, 170, 255, 0.55) 21%,
      rgba(170, 0, 255, 0.55) 28%,
      rgba(255, 0, 132, 0.55) 35%
    ),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 4px);
  background-size:
    300% 300%,
    auto;
  background-position:
    var(--mx) var(--my),
    0 0;
  mix-blend-mode: color-dodge;
  opacity: 0.35;
  filter: brightness(0.8) contrast(1.4);
  animation: holo-idle 6s ease-in-out infinite;
}

.holo.active .car-card__shine {
  animation: none;
  opacity: calc(0.35 + var(--hyp) * 0.4);
}

.r-legendary.holo .car-card__shine {
  opacity: 0.45;
}

.car-card__glare {
  background: radial-gradient(
    circle at var(--mx) var(--my),
    rgba(255, 255, 255, 0.45),
    rgba(255, 255, 255, 0.08) 30%,
    transparent 60%
  );
  mix-blend-mode: overlay;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.active .car-card__glare {
  opacity: 1;
}

.r-legendary.holo .car-card__frame::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image:
    radial-gradient(circle, #fff 0 1px, transparent 1.5px), radial-gradient(circle, #ffe9a8 0 1px, transparent 1.5px);
  background-size:
    37px 41px,
    53px 47px;
  background-position:
    0 0,
    20px 15px;
  opacity: 0.35;
  animation: sparkle 3s linear infinite;
}

@keyframes holo-idle {
  0%,
  100% {
    background-position:
      0% 0%,
      0 0;
  }
  50% {
    background-position:
      100% 100%,
      0 0;
  }
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0.15;
  }
  50% {
    opacity: 0.55;
  }
}

/* Carte non possédée */
.locked .car-card__body {
  background: linear-gradient(145deg, #39404d, #232831);
  filter: grayscale(1);
}

.locked .car-card__frame {
  opacity: 0.55;
}

.locked .car-card__placeholder {
  color: #8b97b0;
}
</style>
