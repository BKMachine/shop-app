<template>
  <label
    class="calc-field"
    :class="{
      'is-active': active,
      'is-solved': solved,
      'is-stacked': stacked,
      'is-locked': locked,
    }"
    :style="{ '--accent': accent }"
    :title="locked"
  >
    <div class="calc-field__label">
      <div class="calc-field__name">
        <v-icon :icon="icon" size="16" />
        <span>{{ label }}</span>
        <span v-if="solved" class="calc-field__badge" title="Calculated">
          <v-icon icon="mdi-function-variant" size="12" />
        </span>
      </div>
      <slot name="action" />
    </div>
    <input
      autocomplete="off"
      class="calc-field__input"
      :disabled="!!locked"
      inputmode="decimal"
      placeholder="—"
      spellcheck="false"
      :value="text"
      @blur="emit('blur')"
      @focus="emit('focus')"
      @input="emit('input', ($event.target as HTMLInputElement).value)"
      @keydown.down.prevent="nudge(-1, $event)"
      @keydown.up.prevent="nudge(1, $event)"
    />
    <span class="calc-field__unit">{{ unit }}</span>
  </label>
</template>

<script setup lang="ts">
import { formatNumber, parsePositive } from '@/lib/useLinkedFields';

const props = defineProps<{
  text: string;
  label: string;
  unit: string;
  icon: string;
  accent: string;
  step: number;
  active?: boolean;
  solved?: boolean;
  stacked?: boolean;
  percent?: boolean;
  locked?: string;
}>();

const emit = defineEmits<{
  input: [value: string];
  focus: [];
  blur: [];
}>();

function nudge(direction: 1 | -1, event: KeyboardEvent) {
  // Percent entries step in whole percents and keep their % sign.
  const percent = props.percent || props.text.trim().endsWith('%');
  const scale = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
  const step = (percent ? 1 : props.step) * scale;
  const current = parsePositive(props.text) ?? 0;
  // Snap to the step grid so repeated nudges land on clean numbers.
  const next = Math.max(step, Math.round((current + direction * step) / step) * step);
  emit('input', `${formatNumber(next, 5)}${percent ? '%' : ''}`);
}
</script>

<style scoped>
.calc-field {
  position: relative;
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 16px;
  border: 1px solid var(--tile-border);
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  cursor: text;
  overflow: hidden;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.calc-field.is-locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.calc-field.is-locked .calc-field__input {
  cursor: not-allowed;
}

.calc-field::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--accent);
  opacity: 0.6;
  transition: opacity 0.2s;
}

.calc-field.is-active {
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 6px 22px -8px var(--accent);
}

.calc-field.is-active::before {
  opacity: 1;
}

.calc-field__label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.calc-field__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--accent);
}

.calc-field__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  color: rgb(var(--v-theme-surface));
  background: var(--accent);
}

.calc-field__input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
  font-size: 1.6rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  text-align: right;
}

.calc-field.is-solved .calc-field__input {
  color: var(--accent);
}

.calc-field__input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.25);
}

.calc-field__unit {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.55;
}
.calc-field.is-stacked {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0 6px;
  padding: 6px 10px 4px 14px;
}

.calc-field.is-stacked .calc-field__label {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 22px;
}

.calc-field.is-stacked .calc-field__input {
  font-size: 1.35rem;
}
</style>
