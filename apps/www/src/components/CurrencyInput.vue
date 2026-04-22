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
  />
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { type CurrencyDisplay, useCurrencyInput } from 'vue-currency-input';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  label: string;
  disabled?: boolean;
  hideDetails?: boolean | 'auto';
  rules?: readonly any[];
}>();

const modelValue = defineModel<number | null>();

const { inputRef, formattedValue, numberValue, setValue } = useCurrencyInput({
  currency: 'USD',
  hideCurrencySymbolOnFocus: false,
  hideGroupingSeparatorOnFocus: false,
  precision: 2,
  valueRange: { min: 0 },
  currencyDisplay: 'hidden' as CurrencyDisplay,
});

watch(numberValue, (value) => {
  modelValue.value = value == null ? null : Number(value);
});

watch(
  modelValue,
  (value) => {
    setValue(value ?? null);
  },
  { immediate: true },
);
</script>

<style scoped></style>
