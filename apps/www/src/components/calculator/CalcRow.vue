<template>
  <section class="calc-row">
    <header class="calc-row__header">
      <div class="calc-row__title" :title="row.subtitle">{{ row.title }}</div>
      <div class="calc-formula">
        <template v-for="(token, index) in row.formula" :key="index">
          <span v-if="typeof token === 'string'">{{ token }}</span>
          <span
            v-else
            class="calc-formula__term"
            :class="{
              'is-active': highlightKey === token.key,
              'is-solved': row.solvedKeys.includes(token.key),
            }"
            :style="{ '--accent': CALC_ACCENTS[token.key] }"
            >{{
              token.text
            }}</span
          >
        </template>
      </div>
      <v-btn
        :aria-label="`Clear ${row.title}`"
        density="comfortable"
        icon="mdi-eraser"
        size="small"
        title="Clear"
        variant="text"
        @click="row.clear()"
      />
    </header>

    <div v-if="stackedFields.length" class="calc-fields__grid">
      <CalcField
        v-for="field in stackedFields"
        :key="field.key"
        v-bind="fieldProps(field)"
        stacked
        @blur="onBlur(field.key)"
        @focus="emit('highlight', 'focus', field.key)"
        @input="row.setInput(field.key, $event)"
        @mouseenter="emit('highlight', 'hover', field.key)"
        @mouseleave="emit('highlight', 'hover', null)"
      >
        <template v-if="$slots[`action-${field.key}`]" #action>
          <slot :name="`action-${field.key}`" />
        </template>
      </CalcField>
    </div>

    <div class="calc-fields">
      <CalcField
        v-for="field in listFields"
        :key="field.key"
        v-bind="fieldProps(field)"
        @blur="onBlur(field.key)"
        @focus="emit('highlight', 'focus', field.key)"
        @input="row.setInput(field.key, $event)"
        @mouseenter="emit('highlight', 'hover', field.key)"
        @mouseleave="emit('highlight', 'hover', null)"
      >
        <template v-if="$slots[`action-${field.key}`]" #action>
          <slot :name="`action-${field.key}`" />
        </template>
      </CalcField>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CALC_ACCENTS, type CalcFieldDef, type CalcRowModel } from '@/lib/calculatorFigure';
import CalcField from './CalcField.vue';

const props = defineProps<{
  row: CalcRowModel;
  // The field highlighted anywhere on the page, and the one highlighted in this row.
  highlightKey: string | null;
  activeKey: string | null;
}>();

const emit = defineEmits<{
  highlight: [source: 'focus' | 'hover', key: string | null];
}>();

const stackedFields = computed(() => props.row.fields.filter((field) => field.stacked));
const listFields = computed(() => props.row.fields.filter((field) => !field.stacked));

function fieldProps(field: CalcFieldDef) {
  return {
    accent: CALC_ACCENTS[field.key],
    active: props.activeKey === field.key,
    icon: field.icon,
    label: field.label,
    locked: field.locked,
    percent: field.percent,
    solved: props.row.solvedKeys.includes(field.key),
    step: field.step,
    text: props.row.text[field.key],
    unit: field.unit,
  };
}

function onBlur(key: string) {
  emit('highlight', 'focus', null);
  props.row.commit?.(key);
}
</script>

<style scoped>
.calc-row {
  border: 1px solid var(--tile-border);
  border-radius: 14px;
  padding: 10px 14px 14px;
  background: var(--tile-bg);
}

.calc-row__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.calc-row__title {
  white-space: nowrap;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.calc-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calc-fields__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.calc-formula {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px dashed var(--tile-border);
  font-family: ui-monospace, "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
  font-size: 0.8rem;
}

.calc-formula__term {
  padding: 1px 4px;
  border-radius: 6px;
  color: var(--accent);
  transition:
    background-color 0.2s,
    color 0.2s;
}

.calc-formula__term.is-solved {
  text-decoration: underline 2px;
  text-underline-offset: 4px;
}

.calc-formula__term.is-active {
  color: rgb(var(--v-theme-surface));
  background: var(--accent);
}
</style>
