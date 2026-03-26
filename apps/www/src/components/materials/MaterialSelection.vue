<template>
  <v-select
    :disabled="disabled"
    hide-details
    item-title="name"
    item-value="value"
    :items="items"
    :label="label"
    :model-value="modelValue"
    required
    @update:model-value="onUpdate"
  >
    <template #item="data">
      <v-list-item v-if="data.props.header"> {{ data.props.header }} </v-list-item>
      <v-divider v-else-if="data.props.divider" />
      <v-list-subheader v-else v-bind="data.props" class="material-select-item">
        {{ data.item.value }}
      </v-list-subheader>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { materials } from '@repo/utilities/materials';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    label?: string;
  }>(),
  {
    disabled: false,
    label: 'Material Type',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// This typing ensures that all MaterialCategory values are included in the categoryOrder array
const categoryOrder = [
  'aluminum',
  'steel',
  'stainless',
  'titanium',
  'other',
] as const satisfies readonly MaterialCategory[];
type MissingMaterialCategories = Exclude<MaterialCategory, (typeof categoryOrder)[number]>;
const hasAllMaterialCategories: MissingMaterialCategories extends never ? true : never = true;

const items = computed(() => {
  const groupedMaterials = Object.entries(materials).reduce(
    (groups, [name, data]) => {
      const category = data.category;
      groups[category] ??= [];
      groups[category].push({ name, value: name });
      return groups;
    },
    {} as Partial<Record<MaterialCategory, { name: string; value: string }[]>>,
  );

  const groupedMaterialEntries = Object.entries(groupedMaterials) as [
    MaterialCategory,
    { name: string; value: string }[],
  ][];

  return groupedMaterialEntries
    .sort(
      ([categoryA], [categoryB]) =>
        categoryOrder.indexOf(categoryA) - categoryOrder.indexOf(categoryB),
    )
    .flatMap(([category, categoryItems], index, categories) => {
      const headerName = category.charAt(0).toUpperCase() + category.slice(1);
      const sortedCategoryItems = [...categoryItems].sort((a, b) => a.name.localeCompare(b.name));

      return [
        { props: { header: headerName } },
        ...sortedCategoryItems,
        ...(index < categories.length - 1 ? [{ props: { divider: true } }] : []),
      ];
    });
});

function onUpdate(value: string) {
  emit('update:modelValue', value);
}
</script>

<style scoped>
.material-select-item {
  cursor: pointer;
}
</style>
