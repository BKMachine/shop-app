<template>
  <div
    ref="wheelEl"
    class="color-wheel"
    :style="{ width: `${size}px`, height: `${size}px` }"
    title="Drag to pick a colour"
    @pointerdown="onPointerDown"
  >
    <div
      v-if="marker"
      class="color-wheel__marker"
      :style="{ left: `${marker.x}px`, top: `${marker.y}px`, background: modelValue }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{ size?: number }>(), { size: 200 });

/** `#rrggbb`, or '' for none. */
const modelValue = defineModel<string>({ default: '' });

/** Lightness every picked colour gets; the wheel only chooses hue and saturation. */
const LIGHTNESS = 50;

const wheelEl = ref<HTMLElement | null>(null);

const marker = computed(() => {
  const hsl = hexToHsl(modelValue.value);
  if (!hsl) return null;
  const radius = props.size / 2;
  const angle = ((hsl.h - 90) * Math.PI) / 180;
  const distance = (hsl.s / 100) * radius;
  return { x: radius + Math.cos(angle) * distance, y: radius + Math.sin(angle) * distance };
});

function pick(event: PointerEvent) {
  const rect = wheelEl.value?.getBoundingClientRect();
  if (!rect) return;
  const radius = rect.width / 2;
  const dx = event.clientX - rect.left - radius;
  const dy = event.clientY - rect.top - radius;
  // 0° at the top, clockwise, to match the conic gradient.
  const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  const saturation = Math.min(Math.hypot(dx, dy) / radius, 1) * 100;
  modelValue.value = hslToHex((hue + 360) % 360, saturation, LIGHTNESS);
}

function onPointerDown(event: PointerEvent) {
  const el = wheelEl.value;
  if (!el) return;
  event.preventDefault();
  el.setPointerCapture(event.pointerId);
  pick(event);

  const move = (moveEvent: PointerEvent) => pick(moveEvent);
  const end = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointercancel', end);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function hexToHsl(hex: string): { h: number; s: number } | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0 };

  const s = delta / (1 - Math.abs(2 * lightness - 1));
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  return { h: (h * 60 + 360) % 360, s: Math.min(s, 1) * 100 };
}
</script>

<style scoped>
.color-wheel {
  position: relative;
  flex: none;
  border-radius: 50%;
  background:
    radial-gradient(circle closest-side, hsl(0 0% 50%), transparent),
    conic-gradient(
      hsl(0 100% 50%),
      hsl(60 100% 50%),
      hsl(120 100% 50%),
      hsl(180 100% 50%),
      hsl(240 100% 50%),
      hsl(300 100% 50%),
      hsl(360 100% 50%)
    );
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%);
  cursor: crosshair;
  touch-action: none;
}

.color-wheel__marker {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 45%),
    0 2px 6px rgb(0 0 0 / 35%);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
</style>
