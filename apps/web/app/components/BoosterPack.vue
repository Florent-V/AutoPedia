<script setup lang="ts">
withDefaults(defineProps<{ tearing?: boolean; disabled?: boolean; label?: string }>(), {
  tearing: false,
  disabled: false,
  label: 'Booster Classique',
});
</script>

<template>
  <div class="pack" :class="{ tearing, disabled }">
    <div class="pack__top">
      <div class="pack__crimp" />
    </div>
    <div class="pack__body">
      <div class="pack__foil" />
      <div class="pack__content">
        <div class="pack__brand">
          <span>Auto</span><span>Pedia</span>
        </div>
        <div class="pack__stripe" />
        <CarSilhouette class="pack__car" />
        <div class="pack__label">{{ label }}</div>
        <div class="pack__count">5 cartes</div>
      </div>
      <div class="pack__crimp pack__crimp--bottom" />
    </div>
  </div>
</template>

<style scoped>
.pack {
  position: relative;
  width: 100%;
  aspect-ratio: 5 / 8;
  container-type: inline-size;
  filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.55));
}

.pack__top {
  position: absolute;
  inset: 0 0 auto 0;
  height: 9%;
  background: linear-gradient(90deg, #b8bfcc, #f2f5fa 30%, #9aa3b3 60%, #e7ebf2);
  border-radius: 3cqw 3cqw 0 0;
  transform-origin: 0% 100%;
  transition:
    transform 0.6s cubic-bezier(0.3, 0.7, 0.4, 1.4),
    opacity 0.6s ease;
  z-index: 2;
}

.pack__body {
  position: absolute;
  inset: 9% 0 0 0;
  border-radius: 0 0 3cqw 3cqw;
  overflow: hidden;
  background:
    radial-gradient(90% 60% at 50% 30%, rgba(255, 176, 32, 0.35), transparent 70%),
    linear-gradient(160deg, #ff3d3d 0%, #7a0f1c 45%, #1a0b16 100%);
}

.pack__crimp {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 3cqw;
  background:
    linear-gradient(135deg, transparent 50%, #7a0f1c 50%) 0 0 / 3cqw 3cqw repeat-x,
    linear-gradient(225deg, transparent 50%, #7a0f1c 50%) 0 0 / 3cqw 3cqw repeat-x;
  opacity: 0.6;
}

.pack__crimp--bottom {
  top: auto;
  bottom: 0;
  background: repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.4) 0 2px, transparent 2px 5px);
  height: 5%;
}

.pack__foil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.45) 45%,
    rgba(255, 220, 160, 0.25) 50%,
    transparent 60%
  );
  background-size: 250% 100%;
  animation: foil 3.5s ease-in-out infinite;
  mix-blend-mode: screen;
}

.pack__content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10cqw 6cqw 12cqw;
  gap: 4cqw;
  text-align: center;
}

.pack__brand {
  font-family: var(--font-display);
  font-size: 15cqw;
  line-height: 1;
  transform: rotate(-6deg);
  text-shadow:
    0 3px 0 rgba(0, 0, 0, 0.4),
    0 0 20px rgba(255, 176, 32, 0.4);
}

.pack__brand span:first-child {
  color: #fff;
}

.pack__brand span:last-child {
  color: var(--accent-2);
}

.pack__stripe {
  width: 130%;
  height: 4cqw;
  margin: 2cqw 0;
  background: repeating-linear-gradient(90deg, #fff 0 4cqw, #111 4cqw 8cqw);
  transform: rotate(-6deg);
  opacity: 0.85;
}

.pack__car {
  width: 85cqw;
  margin-top: auto;
  color: rgba(0, 0, 0, 0.55);
  filter: drop-shadow(0 0 10px rgba(255, 176, 32, 0.5));
}

.pack__label {
  font: 700 5.5cqw var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.pack__count {
  font-size: 4.6cqw;
  padding: 1cqw 4cqw;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
}

.tearing .pack__top {
  transform: translate(30%, -120%) rotate(-25deg);
  opacity: 0;
}

.disabled {
  filter: grayscale(1) brightness(0.5);
}

@keyframes foil {
  0%,
  100% {
    background-position: 120% 0;
  }
  50% {
    background-position: -20% 0;
  }
}
</style>
