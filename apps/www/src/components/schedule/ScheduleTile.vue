<template>
  <div
    :aria-label="tooltip"
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
  >
    <!-- A longer hover opens the booking's details, part image included. -->
    <v-tooltip
      activator="parent"
      content-class="schedule-tile__details hover-card"
      :disabled="active || !details"
      location="top"
      max-width="320"
      :open-delay="DETAILS_DELAY_MS"
      :open-on-focus="false"
    >
      <div class="schedule-tile__details-card">
        <v-img
          v-if="entry.job.partImg && !imageFailed"
          class="schedule-tile__details-img"
          contain
          :src="entry.job.partImg"
          @error="imageFailed = true"
        />
        <div class="schedule-tile__details-title">
          <v-icon v-if="entry.job.priority === 'rush'" color="error" icon="mdi-fire" size="16" />
          #{{ entry.job.jobNumber }} · {{ entry.job.customerName }}
        </div>
        <div v-for="line in tooltipLines.slice(1)" :key="line" class="schedule-tile__details-line">
          {{ line }}
        </div>
      </div>
    </v-tooltip>
    <div class="schedule-tile__body">
      <div class="schedule-tile__line schedule-tile__line--primary">
        <v-icon
          v-if="entry.job.priority === 'rush'"
          class="schedule-tile__rush"
          icon="mdi-fire"
          size="14"
        />
        <span class="schedule-tile__job">#{{ entry.job.jobNumber }}</span>
        <span
          v-if="entry.op != null && width >= 56"
          class="schedule-tile__op"
          :class="{ 'schedule-tile__op--removed': opRemoved }"
        >
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
import { computed, ref, watch } from 'vue';
import { customerColor, formatDay } from '@/lib/schedule';
import { useCustomerStore } from '@/stores/customer_store';

/** Width from which a tile shows the part number and a separate days column. */
const WIDE_TILE_PX = 110;
/** How long the pointer rests on a tile before its details open. */
const DETAILS_DELAY_MS = 700;

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
  /** The booked op has been removed from the part's routing. */
  opRemoved?: boolean;
  /** Open the details card on a long hover (off where nobody hovers, like the wall display). */
  details?: boolean;
}>();

const imageFailed = ref(false);
watch(
  () => props.entry.job.partImg,
  () => {
    imageFailed.value = false;
  },
);

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

const tooltipLines = computed(() => {
  const { job } = props.entry;
  const lines = [
    `#${job.jobNumber} · ${job.customerName}`,
    props.entry.op != null
      ? `Op ${props.entry.op}${props.entry.operation ? ` · ${props.entry.operation}` : ''}${
          props.opRemoved ? ' (removed from the routing)' : ''
        }`
      : 'Whole job',
    [job.partNumber, job.partDescription].filter(Boolean).join(' – '),
    `Qty ${job.qty}`,
    remainingDays.value == null
      ? `${props.entry.days} day${props.entry.days === 1 ? '' : 's'}`
      : `${remainingDays.value} of ${props.entry.days} days left`,
  ];
  if (job.dueDate) lines.push(`Due ${formatDay(job.dueDate, { month: 'short', day: 'numeric' })}`);
  return lines.filter(Boolean);
});

const tooltip = computed(() => tooltipLines.value.join('\n'));
</script>

<style scoped>
.schedule-tile {
  /*
   * The customer shows as a stripe down the left edge and a faint wash, not a fill: a red or
   * green customer would otherwise read as a late or on-time booking. Only the border means
   * due status.
   */
  --tile-bg: color-mix(in srgb, var(--customer-color) 10%, #f6f6f6);
  --tile-edge: #9e9e9e;
  --tile-text: rgb(0 0 0 / 87%);
  --tile-stripe: inset 5px 0 0 var(--customer-color);
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  overflow: hidden;
  border: 2px solid var(--tile-edge);
  border-radius: 6px;
  background: var(--tile-bg);
  box-shadow: var(--tile-stripe);
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
  --tile-bg: color-mix(in srgb, var(--customer-color) 14%, #2a2a2a);
  --tile-edge: #757575;
  --tile-text: rgb(255 255 255 / 92%);
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
  box-shadow:
    var(--tile-stripe),
    0 6px 18px rgb(0 0 0 / 35%);
  cursor: grabbing;
}

.schedule-tile__body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 4px 0 9px;
}

.schedule-tile--narrow {
  --tile-stripe: inset 4px 0 0 var(--customer-color);
}

.schedule-tile--narrow .schedule-tile__body {
  padding: 0 2px 0 6px;
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

/* The booked op is gone from the routing. */
.schedule-tile__op--removed {
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  text-decoration: line-through;
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

/* The tooltip is teleported out of the tile, so its styles can't be scoped to it. */
:global(.schedule-tile__details) {
  padding: 8px 10px !important;
}

:global(.schedule-tile__details-line) {
  color: var(--hover-card-ink-soft);
}

:global(.schedule-tile__details-card) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8125rem;
  line-height: 1.35;
}

:global(.schedule-tile__details-img) {
  width: 300px;
  max-width: 100%;
  height: 160px;
  margin-bottom: 6px;
  border-radius: 4px;
  background: white;
}

:global(.schedule-tile__details-title) {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
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
