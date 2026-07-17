<template>
  <div :aria-label="label" class="material-swatch" :title="label">
    <span class="material-swatch__half material-swatch__half--left" :class="leftClass" />
    <span class="material-swatch__half material-swatch__half--right" :class="rightClass" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  ordered?: string | Date | null;
  onHand?: string | Date | null;
}>();

const hasOrdered = computed(() => Boolean(props.ordered));
const hasOnHand = computed(() => Boolean(props.onHand));

const leftClass = computed(() => {
  if (hasOrdered.value || hasOnHand.value) return 'material-swatch__half--partial';
  return 'material-swatch__half--inactive';
});

const rightClass = computed(() => {
  if (hasOnHand.value) return 'material-swatch__half--active';
  return 'material-swatch__half--inactive';
});

const label = computed(() => {
  const orderedLabel = hasOrdered.value ? 'ordered' : 'not ordered';
  const onHandLabel = hasOnHand.value ? 'on hand' : 'not on hand';
  return `Material ${orderedLabel}; ${onHandLabel}`;
});
</script>

<style scoped>
.material-swatch {
  display: inline-flex;
  align-items: stretch;
  width: 32px;
  height: 18px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.35);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.04);
}

.material-swatch__half {
  flex: 1;
}

.material-swatch__half + .material-swatch__half {
  border-left: 1px solid rgba(0, 0, 0, 0.25);
}

.material-swatch__half--active {
  background: rgba(var(--v-theme-success), 0.9);
}

.material-swatch__half--partial {
  background: rgba(var(--v-theme-success), 0.5);
}

.material-swatch__half--inactive {
  background: transparent;
}
</style>
