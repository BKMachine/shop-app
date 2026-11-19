<template>
  <div
    :class="[
      'schedule-tile',
      `schedule-tile--${dueTone}`,
      {
        'schedule-tile--active': active,
        'schedule-tile--done': isDone,
        'schedule-tile--narrow': width < 56,
        'schedule-tile--tiny': width < 28,
        'schedule-tile--clipped-start': clippedStart,
        'schedule-tile--clipped-end': clippedEnd,
      },
    ]"
    :style="{ '--customer-color': color }"
    :title="tooltip"
  >
    <div class="schedule-tile__body">
      <div class="schedule-tile__line schedule-tile__line--primary">
        <v-icon
          v-if="entry.job.priority === 'rush'"
          class="schedule-tile__rush"
          icon="mdi-fire"
          size="14"
        />
        <span class="schedule-tile__job">#{{ entry.job.jobNumber }}</span>
        <span v-if="entry.op != null && width >= 56" class="schedule-tile__op">
          {{ entry.op }}
        </span>
        <span v-if="width >= 150" class="schedule-tile__customer">
          {{ entry.job.customerName }}
        </span>
      </div>
      <!-- Wide tiles keep the days in their own column; narrower ones trade the part for it. -->
      <div v-if="width >= WIDE_TILE_PX" class="schedule-tile__line schedule-tile__part">
        {{ entry.job.partNumber || entry.job.partDescription }}
      </div>
      <div v-else-if="width >= 56" class="schedule-tile__line schedule-tile__days-line">
        {{ daysLabel }}
      </div>
    </div>
    <div v-if="width >= WIDE_TILE_PX" class="schedule-tile__days">{{ daysLabel }}</div>
    <div v-if="resizable" class="schedule-tile__resize" title="Drag to change length" />
  </div>
</template>

<script setup lang="ts">
import { diffDays, scheduleDueTone, scheduleEnd } from '@repo/utilities/schedule';
import { computed } from 'vue';
import { customerColor, formatDay } from '@/lib/schedule';
import { useCustomerStore } from '@/stores/customer_store';

/** Width from which a tile shows the part number and a separate days column. */
const WIDE_TILE_PX = 110;

const props = defineProps<{
  entry: Pick<ScheduleEntry, 'start' | 'days' | 'job' | 'op' | 'operation'>;
  /** Rendered width in px, used to decide how much fits. */
  width: number;
  today: string;
  active?: boolean;
  resizable?: boolean;
  /** The booking starts before the visible range. */
  clippedStart?: boolean;
  /** The booking ends after the visible range. */
  clippedEnd?: boolean;
}>();

const customerStore = useCustomerStore();

const color = computed(() => {
  const { customerId } = props.entry.job;
  const customer = customerStore.customers.find((candidate) => candidate._id === customerId);
  return customerColor(customer?.color);
});
const dueTone = computed(() => scheduleDueTone(props.entry, props.entry.job.dueDate));
const isDone = computed(
  () => props.entry.job.status === 'closed' || props.entry.job.status === 'machining_complete',
);

/** Days left when the booking is running today, otherwise its full length. */
const remainingDays = computed(() => {
  const end = scheduleEnd(props.entry);
  if (diffDays(props.entry.start, props.today) < 0 || diffDays(props.today, end) <= 0) return null;
  return diffDays(props.today, end);
});

const daysLabel = computed(() => {
  if (remainingDays.value == null) return `${props.entry.days}d`;
  return props.width >= 140 || (props.width >= 80 && props.width < WIDE_TILE_PX)
    ? `${remainingDays.value}d left`
    : `${remainingDays.value}/${props.entry.days}d`;
});

const tooltip = computed(() => {
  const { job } = props.entry;
  const lines = [
    `#${job.jobNumber} · ${job.customerName}`,
    props.entry.op != null
      ? `Op ${props.entry.op}${props.entry.operation ? ` · ${props.entry.operation}` : ''}`
      : 'Whole job',
    [job.partNumber, job.partDescription].filter(Boolean).join(' – '),
    `Qty ${job.qty}`,
    remainingDays.value == null
      ? `${props.entry.days} day${props.entry.days === 1 ? '' : 's'}`
      : `${remainingDays.value} of ${props.entry.days} days left`,
  ];
  if (job.dueDate) lines.push(`Due ${formatDay(job.dueDate, { month: 'short', day: 'numeric' })}`);
  return lines.filter(Boolean).join('\n');
});
</script>

<style scoped>
.schedule-tile {
  --tile-bg: color-mix(in srgb, var(--customer-color) 32%, white);
  --tile-edge: color-mix(in srgb, var(--customer-color) 80%, black);
  --tile-text: color-mix(in srgb, var(--customer-color) 25%, black);
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  overflow: hidden;
  border: 2px solid var(--tile-edge);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--tile-text);
  font-size: 0.75rem;
  line-height: 1.2;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition: box-shadow 120ms ease;
  /* Lets the content adapt to the tile's own height, which a wall display stretches. */
  container-type: size;
}

.v-theme--dark .schedule-tile {
  --tile-bg: color-mix(in srgb, var(--customer-color) 45%, #1e1e1e);
  --tile-edge: color-mix(in srgb, var(--customer-color) 75%, #1e1e1e);
  --tile-text: color-mix(in srgb, var(--customer-color) 12%, white);
}

/* Due date thresholds: the border says whether the booking finishes in time. */
.schedule-tile--ok {
  border-color: rgb(var(--v-theme-success));
}

.schedule-tile--tight {
  border-width: 3px;
  border-color: rgb(var(--v-theme-warning));
}

.schedule-tile--late {
  border-width: 3px;
  border-color: rgb(var(--v-theme-error));
}

.schedule-tile--clipped-start {
  border-left-style: dashed;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.schedule-tile--clipped-end {
  border-right-style: dashed;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.schedule-tile--done {
  opacity: 0.55;
}

.schedule-tile--active {
  box-shadow: 0 6px 18px rgb(0 0 0 / 35%);
  cursor: grabbing;
}

.schedule-tile__body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 4px 0 6px;
}

.schedule-tile--narrow .schedule-tile__body {
  padding: 0 2px;
}

.schedule-tile--tiny .schedule-tile__body {
  display: none;
}

.schedule-tile__line {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}

.schedule-tile__job {
  flex: none;
  font-weight: 700;
}

.schedule-tile--narrow .schedule-tile__job {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
}

.schedule-tile__days-line {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.schedule-tile__op {
  flex: none;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 14%, transparent);
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.schedule-tile__customer,
.schedule-tile__part {
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-tile__part {
  display: block;
  opacity: 0.85;
}

.schedule-tile__rush {
  flex: none;
  color: rgb(var(--v-theme-error));
}

.schedule-tile__days {
  flex: none;
  align-self: center;
  padding-right: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.schedule-tile__resize {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 14px;
  cursor: ew-resize;
  touch-action: none;
}

.schedule-tile__resize::after {
  content: "";
  position: absolute;
  top: 25%;
  right: 4px;
  bottom: 25%;
  width: 3px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.35;
}

.schedule-tile--tiny .schedule-tile__resize {
  width: 40%;
}

/* Last, so they win over the plain rules above: a container query adds no specificity. */
@container (max-height: 34px) {
  .schedule-tile__part,
  .schedule-tile__days-line {
    display: none;
  }
}

@container (min-height: 56px) {
  .schedule-tile__body,
  .schedule-tile__days {
    font-size: 0.95rem;
  }
}
</style>
