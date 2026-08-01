<template>
  <v-select
    :clearable="clearable"
    item-title="label"
    item-value="value"
    :items="options"
    :label="label"
    :model-value="modelValue"
    :variant="variant"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" title="">
        <template #prepend>
          <IsoMaterialBadge :code="optionFromSlot(item).value" select />
        </template>
        <v-list-item-title class="ml-3">{{ optionFromSlot(item).label }}</v-list-item-title>
      </v-list-item>
    </template>

    <template #selection="{ item }">
      <div class="iso-material-selection">
        <IsoMaterialBadge :code="optionFromSlot(item).value" select />
      </div>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { type IsoMaterialCode, isoMaterialGroups } from '@repo/utilities/materials';
import { computed } from 'vue';
import IsoMaterialBadge from '@/components/materials/IsoMaterialBadge.vue';

withDefaults(
  defineProps<{
    modelValue: IsoMaterialCode | null;
    label: string;
    clearable?: boolean;
    variant?:
      | 'outlined'
      | 'filled'
      | 'plain'
      | 'underlined'
      | 'solo'
      | 'solo-filled'
      | 'solo-inverted';
  }>(),
  {
    clearable: true,
    variant: 'outlined',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: IsoMaterialCode | null];
}>();

const options = computed(() => {
  return isoMaterialGroups.map((group) => ({
    label: group.label,
    value: group.code,
  }));
});

function optionFromSlot(item: unknown): { label: string; value: IsoMaterialCode } {
  const slotItem = item as
    | { raw?: { label: string; value: IsoMaterialCode }; label?: string; value?: IsoMaterialCode }
    | undefined;

  if (slotItem?.raw) {
    return slotItem.raw;
  }

  return {
    label: slotItem?.label ?? '',
    value: slotItem?.value ?? 'P',
  };
}
</script>

<style scoped>
.iso-material-selection {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.iso-material-selection__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
