<template>
  <span class="schedule-mismatch" :title="title">
    <v-icon icon="mdi-calendar-alert" :size="size" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The job the schedule has on the machine today, if any. */
    scheduledJobNumber?: number | null;
    /** The job(s) actually running, for the tooltip. */
    runningJobNumbers?: Array<number | null | undefined>;
    size?: number | string;
  }>(),
  { scheduledJobNumber: null, runningJobNumbers: () => [], size: 18 },
);

const title = computed(() => {
  const running = props.runningJobNumbers.filter((value) => value != null).map((n) => `#${n}`);
  const runningText = running.length ? `Running ${running.join(', ')}` : 'The job running';
  return props.scheduledJobNumber
    ? `${runningText}, but the schedule has #${props.scheduledJobNumber} on this machine today.`
    : `${runningText}, but nothing is scheduled on this machine today.`;
});
</script>

<style scoped>
.schedule-mismatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: rgb(var(--v-theme-warning));
}
</style>
