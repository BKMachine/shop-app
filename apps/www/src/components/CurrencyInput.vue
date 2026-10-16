<template>
  <v-text-field
    ref="inputRef"
    v-model="formattedValue"
    v-bind="$attrs"
    :disabled="props.disabled"
    :hide-details="props.hideDetails"
    :label="props.label"
    prefix="$"
    :rules="props.rules"
    @blur="handleBlur"
    @focus="handleFocus"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { type CurrencyDisplay, useCurrencyInput } from 'vue-currency-input';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  label: string;
  disabled?: boolean;
  hideDetails?: boolean | 'auto';
  rules?: readonly any[];
}>();

const modelValue = defineModel<number | null>();
const isFocused = ref(false);

// autoEmit off: the library would otherwise emit update:modelValue itself on every change,
// including the rounding done by setValue(). The watcher below is the only emitter.
const { inputRef, formattedValue, numberValue, setValue } = useCurrencyInput(
  {
    currency: 'USD',
    hideCurrencySymbolOnFocus: false,
    hideGroupingSeparatorOnFocus: false,
    precision: 2,
    valueRange: { min: 0 },
    currencyDisplay: 'hidden' as CurrencyDisplay,
  },
  false,
);

// Only pass on values the user typed. setValue() below rounds to 2 places for display, and
// emitting that rounded number would overwrite the real value (e.g. a derived $2.2855/lb
// becoming $2.29) and make an untouched record look edited.
watch(numberValue, (value) => {
  if (!isFocused.value) return;
  modelValue.value = value == null ? null : Number(value);
});

watch(
  modelValue,
  (value) => {
    if (isFocused.value) return;
    setValue(value ?? null);
  },
  { immediate: true },
);

function handleFocus() {
  isFocused.value = true;
}

function handleBlur() {
  isFocused.value = false;
  setValue(modelValue.value ?? null);
}
</script>

<style scoped></style>
