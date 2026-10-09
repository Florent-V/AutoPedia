<script setup lang="ts">
/** Dessin technique de voiture (vue de profil), choisi selon l'époque du modèle. */
const props = defineProps<{ year?: number | null }>();

const era = computed(() => {
  if (!props.year) return 'modern';
  if (props.year < 1950) return 'vintage';
  if (props.year < 1990) return 'classic';
  return 'modern';
});

const shapes = {
  vintage: {
    body: 'M18 74 C16 66 20 60 30 58 L58 57 L66 48 L84 47 L94 28 L146 28 L154 47 L190 49 C208 50 220 58 222 74 L202 74 A17 17 0 0 0 168 74 L72 74 A17 17 0 0 0 38 74 Z',
    glass: 'M98 32 L120 32 L120 46 L90 46 Z M126 32 L142 32 L148 46 L126 46 Z',
    line: 'M58 57 L190 57',
    lamp: 'M24 62 L32 62',
    wheels: [55, 185],
  },
  classic: {
    body: 'M12 72 C11 64 16 60 26 59 L84 56 L106 40 L150 39 L174 54 L218 56 C227 57 229 64 228 72 L205 72 A18 18 0 0 0 169 72 L73 72 A18 18 0 0 0 37 72 Z',
    glass: 'M90 55 L109 43 L126 43 L126 55 Z M132 43 L148 43 L166 55 L132 55 Z',
    line: 'M26 63 L218 62',
    lamp: 'M14 62 L24 62',
    wheels: [55, 187],
  },
  modern: {
    body: 'M14 72 C10 66 12 60 22 58 L88 50 C102 40 112 34 124 32 L160 32 C174 33 186 42 198 49 L220 53 C228 55 230 62 228 72 L205 72 A18 18 0 0 0 169 72 L73 72 A18 18 0 0 0 37 72 Z',
    glass: 'M94 50 C105 43 113 38 124 37 L138 37 L138 50 Z M144 37 L158 37 C168 38 176 43 186 49 L144 50 Z',
    line: 'M30 61 L214 58',
    lamp: 'M18 60 L32 58',
    wheels: [55, 187],
  },
} as const;

const shape = computed(() => shapes[era.value]);
</script>

<template>
  <svg class="lineart" viewBox="0 0 240 100" aria-hidden="true">
    <!-- cotes -->
    <g class="lineart__dim">
      <path d="M14 92 L228 92 M14 88 L14 96 M228 88 L228 96" />
      <path :d="`M${shape.wheels[0]} 84 L${shape.wheels[0]} 96 M${shape.wheels[1]} 84 L${shape.wheels[1]} 96`" />
    </g>
    <path class="lineart__body" :d="shape.body" />
    <path class="lineart__glass" :d="shape.glass" />
    <path class="lineart__detail" :d="`${shape.line} ${shape.lamp}`" />
    <g v-for="x in shape.wheels" :key="x" class="lineart__wheel">
      <circle :cx="x" cy="76" r="13" />
      <circle :cx="x" cy="76" r="6" />
      <path :d="`M${x - 13} 76 L${x + 13} 76 M${x} 63 L${x} 89`" />
    </g>
  </svg>
</template>

<style scoped>
.lineart {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.lineart__body {
  stroke-width: 2.4;
  fill: color-mix(in srgb, currentColor 10%, transparent);
}

.lineart__glass {
  stroke-width: 1.4;
  fill: color-mix(in srgb, currentColor 22%, transparent);
}

.lineart__detail {
  stroke-width: 1.2;
  opacity: 0.6;
}

.lineart__wheel circle:first-child {
  stroke-width: 2.4;
  fill: rgba(0, 0, 0, 0.35);
}

.lineart__wheel circle:nth-child(2),
.lineart__wheel path {
  stroke-width: 1;
  opacity: 0.55;
}

.lineart__dim {
  stroke-width: 0.8;
  opacity: 0.35;
  stroke-dasharray: 2 3;
}
</style>
