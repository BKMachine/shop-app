<template>
  <v-text-field
    ref="inputRef"
    v-model="formattedValue"
    :label="props.label"
    prepend-inner-icon="mdi-currency-usd"
  />
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { CurrencyDisplay, useCurrencyInput } from 'vue-currency-input';

const props = defineProps<{
  label: string;
  modelValue?: number;
}>();

watch(
  () => props.modelValue,
  (value) => {
    if (value) setValue(value);
  },
);

const { inputRef, formattedValue, setValue } = useCurrencyInput({
  currency: 'USD',
  hideCurrencySymbolOnFocus: false,
  hideGroupingSeparatorOnFocus: false,
  precision: 2,
  valueRange: { min: 0 },
  currencyDisplay: 'hidden' as CurrencyDisplay,
});
</script>

<style scoped></style>
