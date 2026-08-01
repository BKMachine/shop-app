<template>
  <div class="iso-material-selector">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-3">
      <div class="text-subtitle-2">{{ label }}</div>
      <div class="iso-material-legend">
        <span class="legend-swatch state-0">Off</span>
        <span class="legend-swatch state-1">Acceptable</span>
        <span class="legend-swatch state-2">Recommended</span>
      </div>
    </div>

    <div class="iso-material-grid">
      <button
        v-for="group in isoMaterialGroups"
        :key="group.code"
        class="iso-material-option"
        :class="stateClass(group.code)"
        :disabled="disabled"
        :style="{ '--iso-material-color': group.color }"
        type="button"
        @click="cycleState(group.code)"
      >
        <IsoMaterialBadge :code="group.code" />
        <div class="iso-material-copy">
          <div class="iso-material-copy__title">{{ group.label }}</div>
          <div class="iso-material-copy__state">{{ stateLabel(group.code) }}</div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  decodeIsoMaterialValue,
  encodeIsoMaterialValue,
  isoMaterialGroups,
  isoMaterialStateLabels,
  type IsoMaterialCode,
  type IsoMaterialState,
} from '@repo/utilities/materials';
import IsoMaterialBadge from '@/components/materials/IsoMaterialBadge.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: number;
    disabled?: boolean;
    label?: string;
  }>(),
  {
    disabled: false,
    label: 'ISO Material Guide',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const states = computed(() => decodeIsoMaterialValue(props.modelValue));

function cycleState(code: IsoMaterialCode) {
  if (props.disabled) return;

  const nextStates = {
    ...states.value,
    [code]: ((states.value[code] + 1) % 3) as IsoMaterialState,
  };

  emit('update:modelValue', encodeIsoMaterialValue(nextStates));
}

function stateLabel(code: IsoMaterialCode): string {
  return isoMaterialStateLabels[states.value[code]];
}

function stateClass(code: IsoMaterialCode): string {
  return `state-${states.value[code]}`;
}
</script>

<style scoped>
.iso-material-selector {
  border: 1px solid #d6d9de;
  border-radius: 12px;
  padding: 1rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.iso-material-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.legend-swatch {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  font-size: 0.8rem;
}

.iso-material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.iso-material-option {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  border: 1px solid #d4d8de;
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  background: #ffffff;
  text-align: left;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease,
    opacity 0.15s ease;
}

.iso-material-option:hover:not(:disabled) {
  transform: translateY(-1px);
}

.iso-material-option:focus-visible {
  outline: 2px solid #1f2937;
  outline-offset: 2px;
}

.iso-material-option:disabled {
  cursor: not-allowed;
}

.iso-material-copy {
  min-width: 0;
}

.iso-material-copy__title {
  color: #111827;
  font-weight: 600;
}

.iso-material-copy__state {
  color: #4b5563;
  font-size: 0.85rem;
}

.state-0 {
  opacity: 0.6;
  border-style: dashed;
}

.state-1 {
  border-color: var(--iso-material-color);
  box-shadow: inset 0 0 0 1px var(--iso-material-color);
}

.state-2 {
  border-color: var(--iso-material-color);
  background: linear-gradient(135deg, #ffffff 0%, var(--iso-material-color) 180%);
  box-shadow: 0 10px 20px -18px var(--iso-material-color);
}
</style>
