<template>
  <div>
    <v-text-field
      v-model="search"
      clearable
      label="Search Materials"
      prepend-inner-icon="mdi-magnify"
      @click:clear="search = ''"
    />
    <div class="d-flex mb-2 align-center" style="gap: 8px;">
      <v-btn-toggle v-model="typeFilter" dense mandatory>
        <v-btn size="small" value="All">All</v-btn>
        <v-btn size="small" value="Flat">Flat</v-btn>
        <v-btn size="small" value="Round">Round</v-btn>
      </v-btn-toggle>
      <v-btn-toggle v-model="tubingFilter" dense mandatory>
        <v-btn size="small" value="All">All</v-btn>
        <v-btn size="small" value="Tubing">Tubing</v-btn>
        <v-btn size="small" value="Bar">Bar</v-btn>
      </v-btn-toggle>
    </div>

    <v-list class="materials-list" density="compact" nav>
      <v-list-item
        v-for="material in sortedFilteredMaterials"
        :key="material._id"
        :active="material._id === selectedMaterialId"
        class="material-row"
        @click="emit('select', material)"
      >
        <v-list-item-title class="material-title">
          {{ formatMaterialTitle(material) }}
        </v-list-item-title>

        <v-list-item-subtitle class="material-subtitle">
          {{ formatMaterialSize(material) }}
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatNumber } from '@/plugins/utils';

const props = defineProps<{
  materials: Material[];
  selectedMaterialId?: string;
}>();

const emit = defineEmits<{
  select: [material: Material];
}>();

const search = ref('');
const typeFilter = ref<'All' | 'Flat' | 'Round'>('All');
const tubingFilter = ref<'All' | 'Tubing' | 'Bar'>('All');

const sortedFilteredMaterials = computed(() => {
  const q = search.value.trim().toLowerCase();

  return [...props.materials]
    .filter((material) => {
      if (
        q &&
        ![
          material.description,
          material.materialType,
          material.type,
          formatMaterialTitle(material),
          formatMaterialSize(material),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      ) {
        return false;
      }

      if (typeFilter.value !== 'All' && material.type !== typeFilter.value) return false;

      if (tubingFilter.value !== 'All') {
        const isTubing = !!material.wallThickness;
        if (tubingFilter.value === 'Tubing' && !isTubing) return false;
        if (tubingFilter.value === 'Bar' && isTubing) return false;
      }

      return true;
    })
    .sort((a, b) => compareMaterials(a, b));
});

function formatMaterialTitle(material: Material): string {
  const type = material.wallThickness ? 'Tubing' : 'Bar';
  return `${material.materialType} ${material.type} ${type}`;
}

function formatMaterialSize(material: Material): string {
  if (material.type === 'Flat') {
    const height = formatNumber(material.height);
    const width = formatNumber(material.width);
    const wall = material.wallThickness ? ` × ${formatNumber(material.wallThickness)} wall` : '';
    return `${height} × ${width}${wall}`;
  }

  if (material.type === 'Round') {
    const diameter = formatNumber(material.diameter);
    const wall = material.wallThickness ? ` × ${formatNumber(material.wallThickness)} wall` : '';
    return `Ø${diameter}${wall}`;
  }

  return '';
}

function compareMaterials(a: Material, b: Material) {
  const materialCompare = (a.materialType || '').localeCompare(b.materialType || '');
  if (materialCompare !== 0) return materialCompare;

  const typeOrder: Record<string, number> = { Flat: 0, Round: 1 };
  const typeCompare = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
  if (typeCompare !== 0) return typeCompare;

  const aDims = getSortDimensions(a);
  const bDims = getSortDimensions(b);

  for (let index = 0; index < Math.max(aDims.length, bDims.length); index++) {
    const diff = (aDims[index] ?? 0) - (bDims[index] ?? 0);
    if (diff !== 0) return diff;
  }

  return (a.description || '').localeCompare(b.description || '');
}

function getSortDimensions(material: Material): number[] {
  const length = material.length ?? 0;
  const wall = material.wallThickness ?? 0;

  if (material.type === 'Flat') {
    const height = material.height ?? 0;
    const width = material.width ?? 0;
    const small = Math.min(height, width);
    const large = Math.max(height, width);
    return [small, large, wall, length];
  }

  if (material.type === 'Round') {
    const diameter = material.diameter ?? 0;
    return [diameter, wall, length];
  }

  return [length];
}
</script>

<style scoped>
.materials-list {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}

.material-row {
  min-height: 48px;
  padding-top: 4px;
  padding-bottom: 4px;
  border-radius: 6px;
}

.material-title {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-subtitle {
  font-size: 0.8rem;
  line-height: 1rem;
  color: rgb(var(--v-theme-on-surface), 0.7);
}

.selected-item,
.v-list-item--active {
  background-color: #e3f2fd;
}
</style>
