<template>
  <div class="iso-material-grid" :title="tooltipText">
    <IsoMaterialBadge
      v-for="group in activeGroups"
      :key="group.code"
      :code="group.code"
      compact
      :state="states[group.code]"
    />
  </div>
</template>

<script setup lang="ts">
import { decodeIsoMaterialValue, isoMaterialGroups } from '@repo/utilities/materials';
import { computed } from 'vue';
import IsoMaterialBadge from '@/components/materials/IsoMaterialBadge.vue';

const props = defineProps<{
  value?: number;
}>();

const states = computed(() => decodeIsoMaterialValue(props.value));

const activeGroups = computed(() => {
  return isoMaterialGroups.filter((group) => states.value[group.code] > 0);
});

const tooltipText = computed(() => {
  if (!activeGroups.value.length) return 'No ISO material guidance set';

  return activeGroups.value
    .map(
      (group) => `${group.code}: ${states.value[group.code] === 2 ? 'Recommended' : 'Acceptable'}`,
    )
    .join(' | ');
});
</script>

<style scoped>
.iso-material-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, max-content));
  gap: 0.22rem;
  min-width: 4.3rem;
  justify-content: center;
}
</style>
