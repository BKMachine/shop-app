<template>
  <div
    class="iso-material-badge"
    :class="[
      `state-${state}`,
      {
        'iso-material-badge--compact': compact,
        'iso-material-badge--select': select,
      },
    ]"
    :style="badgeStyle"
    :title="material.label"
  >
    {{ material.code }}
  </div>
</template>

<script setup lang="ts">
import {
  type IsoMaterialCode,
  type IsoMaterialState,
  isoMaterialGroups,
} from '@repo/utilities/materials';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    code: IsoMaterialCode;
    state?: IsoMaterialState;
    compact?: boolean;
    select?: boolean;
  }>(),
  {
    state: 2,
    compact: false,
    select: false,
  },
);

const material = computed(() => {
  return isoMaterialGroups.find((group) => group.code === props.code) ?? isoMaterialGroups[0];
});

const badgeStyle = computed(() => {
  if (props.state === 2) {
    return {
      backgroundColor: material.value.color,
      borderColor: material.value.color,
    };
  }

  return {
    backgroundColor: '#ffffff',
    borderColor: material.value.color,
    color: '#1f2937',
  };
});
</script>

<style scoped>
.iso-material-badge {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 6px;
  border: 2px solid transparent;
  color: #1f2937;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
}

.iso-material-badge--compact {
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 3px;
  border-width: 1.5px;
  font-size: 0.78rem;
}

.iso-material-badge--select {
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 4px;
  border-width: 1.5px;
  font-size: 0.98rem;
}

.state-0 {
  opacity: 0.45;
}
</style>
