<template>
  <div>
    Last Cycle:
    <template v-if="latest > 0">
      <v-tooltip v-if="history.length > 1" location="bottom" open-delay="150">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="last-cycle-value last-cycle-value--hover">
            {{ formatCycleDuration(latest) }}
          </span>
        </template>
        <div class="cycle-history-tooltip">
          <div
            v-for="(cycle, index) in history"
            :key="index"
            :class="[
              'cycle-history-tooltip__row',
              index === 0 ? 'cycle-history-tooltip__row--latest' : '',
            ]"
          >
            <span class="cycle-history-tooltip__index">{{ index + 1 }}.</span>
            <span>{{ formatCycleDuration(cycle) }}</span>
          </div>
        </div>
      </v-tooltip>
      <span v-else class="last-cycle-value">{{ formatCycleDuration(latest) }}</span>
    </template>
    <template v-else>---</template>
    <span v-if="macroTimer !== undefined"> ({{ macroTimer }})</span>
  </div>
</template>

<script setup lang="ts">
import { Duration } from 'luxon';
import { computed } from 'vue';

const props = defineProps<{
  lastCycle: MachineLastCycle;
  /** Shown in parentheses after the cycle time when defined. */
  macroTimer?: string;
}>();

const history = computed(() => {
  const { lastCycle } = props;
  if (Array.isArray(lastCycle)) return lastCycle.filter((cycle) => cycle > 0);
  return lastCycle > 0 ? [lastCycle] : [];
});

const latest = computed(() => history.value[0] ?? 0);

function formatCycleDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const dur = Duration.fromObject({ seconds });
  if (dur.as('hours') > 1) return dur.toFormat('h:mm:ss');
  return dur.toFormat('m:ss');
}
</script>

<style scoped>
.last-cycle-value {
  display: inline-block;
}

.last-cycle-value--hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.cycle-history-tooltip {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cycle-history-tooltip__row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.cycle-history-tooltip__row--latest {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cycle-history-tooltip__index {
  min-width: 1.25rem;
  opacity: 0.7;
}
</style>
