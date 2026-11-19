<template>
  <v-dialog v-model="open" max-width="640">
    <v-card v-if="job">
      <v-card-title class="schedule-dialog__title">
        <span>Job #{{ job.jobNumber }}</span>
        <span v-if="op != null" class="schedule-dialog__op">
          Op {{ op }}<template v-if="operation"> · {{ operation }}</template>
        </span>
        <v-chip v-if="job.priority === 'rush'" color="error" prepend-icon="mdi-fire" size="small">
          Rush
        </v-chip>
        <v-btn
          class="ms-auto"
          :prepend-icon="uiIcons.job"
          size="small"
          :to="{ name: 'viewJob', params: { id: job._id } }"
          variant="text"
        >
          Open Job
        </v-btn>
      </v-card-title>
      <div class="schedule-dialog__header">
        <v-img
          v-if="job.partImg && !imageFailed"
          class="schedule-dialog__img"
          contain
          :src="job.partImg"
          @error="imageFailed = true"
        />
        <div class="schedule-dialog__subtitle">
          <div class="font-weight-medium">{{ job.customerName }}</div>
          <div>
            {{ [job.partNumber, job.partDescription].filter(Boolean).join(' – ') }} · Qty
            {{ job.qty }}
          </div>
          <div v-if="job.dueDate" :class="`text-${dueDateColor(job.dueDate)}`">
            Due {{ formatDay(job.dueDate, { weekday: 'short', month: 'short', day: 'numeric' }) }}
            ({{ formatRelativeDate(job.dueDate) }})
          </div>
          <div v-else>No due date</div>
        </div>
      </div>

      <v-card-text class="d-flex flex-column ga-4 pt-4">
        <v-select
          v-model="machineId"
          hide-details
          item-title="displayName"
          item-value="id"
          :items="machines"
          label="Machine"
          variant="outlined"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :subtitle="item.department || 'No department'" />
          </template>
        </v-select>
        <div class="schedule-dialog__when">
          <v-text-field
            v-model="start"
            class="schedule-dialog__start"
            hide-details
            label="Start"
            type="date"
            variant="outlined"
            @update:model-value="startEdited = true"
          />
          <div class="schedule-dialog__days">
            <v-btn
              aria-label="One day shorter"
              :disabled="days !== null && days <= 1"
              icon="mdi-minus"
              size="small"
              variant="tonal"
              @click="changeDays((days ?? 2) - 1)"
            />
            <v-text-field
              v-model="daysInput"
              class="schedule-dialog__days-input"
              :error="days === null"
              hide-details
              inputmode="numeric"
              label="Days"
              :max="MAX_SCHEDULE_DAYS"
              min="1"
              step="1"
              type="number"
              variant="outlined"
              @blur="tidyDays"
              @focus="selectAll"
              @update:model-value="daysEdited = true"
            />
            <v-btn
              aria-label="One day longer"
              :disabled="days !== null && days >= MAX_SCHEDULE_DAYS"
              icon="mdi-plus"
              size="small"
              variant="tonal"
              @click="changeDays((days ?? 0) + 1)"
            />
          </div>
        </div>
        <template v-if="firstOpen">
          <div v-if="start === firstOpen" class="schedule-dialog__start-hint">
            <v-icon icon="mdi-calendar-check-outline" size="16" />
            First available start on {{ machineName }}.
          </div>
          <div v-else class="schedule-dialog__start-hint">
            <v-btn
              color="info"
              density="comfortable"
              prepend-icon="mdi-calendar-arrow-right"
              size="small"
              variant="tonal"
              @click="useFirstOpen"
            >
              Use first available start ·
              {{ formatDay(firstOpen, { weekday: 'short', month: 'short', day: 'numeric' }) }}
            </v-btn>
          </div>
        </template>
        <div v-if="estimate" class="schedule-dialog__estimate">
          <v-icon icon="mdi-calculator-variant-outline" size="18" />
          <div class="flex-grow-1">
            <div>
              Estimate: <strong>{{ estimate.workingDays }}</strong>
              working day{{ estimate.workingDays === 1 ? '' : 's' }}
              <span v-if="estimate.days !== estimate.workingDays">
                ({{ estimate.days }}
                with days off)
              </span>
            </div>
            <div class="text-body-small text-medium-emphasis">
              {{ job.qty }} × {{ formatMinutes(estimate.cycleMinutes) }} min =
              {{ formatMinutes(estimate.runMinutes / 60) }} h, at
              {{ formatMinutes(estimate.minutesPerDay / 60) }} h cutting per day ({{
                estimate.utilization
              }}%)
            </div>
          </div>
          <v-btn
            v-if="estimate.days !== days"
            size="small"
            variant="tonal"
            @click="changeDays(estimate.days)"
          >
            Use {{ estimate.days }}d
          </v-btn>
        </div>
        <v-alert v-else-if="opRemoved" density="compact" type="warning" variant="tonal">
          This op is no longer on the part's routing. Remove the booking, or book the op that
          replaced it from the job list.
        </v-alert>
        <div v-else-if="estimator" class="text-body-small text-medium-emphasis">
          {{
            op != null
              ? 'This op has no cycle time to estimate from.'
              : 'Booked as a whole job, so there is no op cycle time to estimate from.'
          }}
        </div>
        <div v-if="days === null" class="text-body-small text-error">
          Enter a whole number of days from 1 to {{ MAX_SCHEDULE_DAYS }}.
        </div>
        <div v-else class="text-body-small text-medium-emphasis">
          Runs through
          {{ formatDay(lastDay, { weekday: 'short', month: 'short', day: 'numeric' }) }}. Later jobs
          on the machine move back if this overlaps them.
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="entry"
          color="error"
          prepend-icon="mdi-calendar-remove"
          variant="text"
          @click="emit('remove')"
        >
          Remove
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!canSave" variant="flat" @click="save">
          {{ entry ? 'Save' : 'Add to Schedule' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import {
  addDays,
  isDayKey,
  MAX_SCHEDULE_DAYS,
  type ScheduleEstimate,
} from '@repo/utilities/schedule';
import { computed, ref, watch } from 'vue';
import { dueDateColor, formatRelativeDate } from '@/lib/job_dates';
import { formatDay } from '@/lib/schedule';
import { uiIcons } from '@/lib/uiIcons';

const open = defineModel<boolean>({ required: true });

const imageFailed = ref(false);

const props = defineProps<{
  /** The booking being edited, or null when booking `job` for the first time. */
  entry: ScheduleEntry | null;
  job: ScheduleEntryJob | null;
  machines: MachineConfig[];
  initial: Omit<ScheduleEntryPlacement, '_id'>;
  /** Routing op number being booked; null for a whole job. */
  op?: number | null;
  operation?: string | null;
  /** The booked op has been removed from the part's routing. */
  opRemoved?: boolean;
  /** Estimates how long the op runs on a machine from a start day. */
  estimator?: (machineId: string, start: string) => ScheduleEstimate | null;
  /** The machine's first available start: the day after its last booking, or today. */
  firstOpenDay?: (machineId: string) => string;
  /**
   * For a new booking: changing the machine moves the start to its first available day (and the
   * length to its estimate) until they are set by hand.
   */
  startFollowsMachine?: boolean;
}>();

const emit = defineEmits<{
  save: [placement: Omit<ScheduleEntryPlacement, '_id'>];
  remove: [];
}>();

const machineId = ref('');
const start = ref('');
/** The days field as typed; kept as text so a half-typed value isn't rewritten under the cursor. */
const daysInput = ref('1');
/** Set once the start or length is chosen by hand, so a machine change leaves it alone. */
const startEdited = ref(false);
const daysEdited = ref(false);

/** The typed length, or null while it isn't a whole number of days the server accepts. */
const days = computed(() => {
  const value = Number(String(daysInput.value).trim());
  return String(daysInput.value).trim() !== '' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_SCHEDULE_DAYS
    ? value
    : null;
});

function setDays(value: number) {
  daysInput.value = String(Math.min(Math.max(Math.round(value), 1), MAX_SCHEDULE_DAYS));
}

/** Rounds or clamps a typed number on leaving the field; leaves anything else to show its error. */
function tidyDays() {
  const value = Number(String(daysInput.value).trim());
  if (String(daysInput.value).trim() !== '' && Number.isFinite(value)) setDays(value);
}

function selectAll(event: FocusEvent) {
  (event.target as HTMLInputElement | null)?.select();
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    imageFailed.value = false;
    startEdited.value = !props.startFollowsMachine;
    daysEdited.value = !props.startFollowsMachine;
    machineId.value = props.initial.machineId;
    start.value = props.initial.start;
    setDays(props.initial.days);
  },
  { immediate: true },
);

/** Re-estimates the length for the machine and start, unless it was set by hand. */
function reestimateDays() {
  if (daysEdited.value || !machineId.value || !isDayKey(start.value)) return;
  const estimated = props.estimator?.(machineId.value, start.value);
  if (estimated) setDays(estimated.days);
}

watch(machineId, (next, previous) => {
  if (!open.value || !props.startFollowsMachine || !next || !previous) return;
  if (!startEdited.value && props.firstOpenDay) start.value = props.firstOpenDay(next);
  reestimateDays();
});

const firstOpen = computed(() =>
  props.firstOpenDay && machineId.value ? props.firstOpenDay(machineId.value) : '',
);

const machineName = computed(
  () =>
    props.machines.find((candidate) => candidate.id === machineId.value)?.displayName ??
    'this machine',
);

/** Moves the start to the machine's first available day; a new booking follows the machine again. */
function useFirstOpen() {
  start.value = firstOpen.value;
  startEdited.value = !props.startFollowsMachine;
  reestimateDays();
}

/** Changes the length from the −/+ buttons or the estimate, as a choice made by hand. */
function changeDays(value: number) {
  daysEdited.value = true;
  setDays(value);
}

const lastDay = computed(() =>
  isDayKey(start.value) && days.value !== null
    ? addDays(start.value, days.value - 1)
    : props.initial.start,
);

const estimate = computed(() => {
  if (!props.estimator || !machineId.value || !isDayKey(start.value)) return null;
  return props.estimator(machineId.value, start.value);
});

function formatMinutes(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const canSave = computed(
  () => Boolean(machineId.value) && isDayKey(start.value) && days.value !== null,
);

function save() {
  if (!canSave.value || days.value === null) return;
  emit('save', { machineId: machineId.value, start: start.value, days: days.value });
}
</script>

<style scoped>
.schedule-dialog__op {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.8;
}

/* Long op names wrap rather than pushing the Open Job button out of the card. */
.schedule-dialog__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  padding-top: 16px;
  white-space: normal;
  line-height: 1.3;
}

.schedule-dialog__header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 4px 24px 0;
}

.schedule-dialog__img {
  flex: 0 0 140px;
  height: 105px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: white;
}

.schedule-dialog__subtitle {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

@media (max-width: 480px) {
  .schedule-dialog__header {
    flex-direction: column;
  }

  .schedule-dialog__img {
    flex-basis: auto;
    width: 100%;
    height: 160px;
  }
}

/*
 * Start takes whatever the days controls leave, capped outright so a browser that draws a wide
 * date field (Firefox) can't push the + button out of the card. On a narrow card they stack.
 */
.schedule-dialog__when {
  --days-controls: 192px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.schedule-dialog__start {
  flex: 1 1 0;
  min-width: 0;
  max-width: calc(100% - var(--days-controls) - 16px);
  /* Sideways only, so the outlined label sitting on the top border isn't cut. */
  overflow-x: clip;
}

.schedule-dialog__start :deep(.v-field),
.schedule-dialog__start :deep(input) {
  min-width: 0;
  width: 100%;
}

.schedule-dialog__days {
  flex: none;
  width: var(--days-controls);
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 480px) {
  .schedule-dialog__when {
    flex-direction: column;
    align-items: flex-start;
  }

  .schedule-dialog__start {
    width: 100%;
    max-width: 100%;
  }
}

.schedule-dialog__start-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -8px;
  color: rgb(var(--v-theme-info));
  font-size: 0.8125rem;
}

.schedule-dialog__estimate {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.schedule-dialog__days-input {
  flex: 0 0 96px;
}

.schedule-dialog__days-input :deep(input) {
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
}

/* The −/+ buttons beside it do the stepping. */
.schedule-dialog__days-input :deep(input::-webkit-inner-spin-button),
.schedule-dialog__days-input :deep(input::-webkit-outer-spin-button) {
  margin: 0;
  appearance: none;
}
</style>
