<template>
  <v-dialog v-model="open" max-width="520">
    <v-card v-if="job">
      <v-card-title class="d-flex align-center ga-2 pt-4">
        <span>Job #{{ job.jobNumber }}</span>
        <span v-if="op != null" class="schedule-dialog__op">
          Op {{ op }}<template v-if="operation"> · {{ operation }}</template>
        </span>
        <v-chip v-if="job.priority === 'rush'" color="error" prepend-icon="mdi-fire" size="small">
          Rush
        </v-chip>
        <v-spacer />
        <v-btn
          :prepend-icon="uiIcons.job"
          size="small"
          :to="{ name: 'viewJob', params: { id: job._id } }"
          variant="text"
        >
          Open Job
        </v-btn>
      </v-card-title>
      <v-card-subtitle class="schedule-dialog__subtitle">
        <div>{{ job.customerName }}</div>
        <div>
          {{ [job.partNumber, job.partDescription].filter(Boolean).join(' – ') }} · Qty
          {{ job.qty }}
        </div>
        <div v-if="job.dueDate" :class="`text-${dueDateColor(job.dueDate)}`">
          Due {{ formatDay(job.dueDate, { weekday: 'short', month: 'short', day: 'numeric' }) }}
          ({{ formatRelativeDate(job.dueDate) }})
        </div>
        <div v-else>No due date</div>
      </v-card-subtitle>

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
        <div class="d-flex ga-4 align-center flex-wrap">
          <v-text-field
            v-model="start"
            class="schedule-dialog__start"
            hide-details
            label="Start"
            type="date"
            variant="outlined"
          />
          <div class="schedule-dialog__days">
            <v-btn
              aria-label="One day shorter"
              :disabled="days !== null && days <= 1"
              icon="mdi-minus"
              size="small"
              variant="tonal"
              @click="setDays((days ?? 2) - 1)"
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
            />
            <v-btn
              aria-label="One day longer"
              :disabled="days !== null && days >= MAX_SCHEDULE_DAYS"
              icon="mdi-plus"
              size="small"
              variant="tonal"
              @click="setDays((days ?? 0) + 1)"
            />
          </div>
        </div>
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
            @click="setDays(estimate.days)"
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
}>();

const emit = defineEmits<{
  save: [placement: Omit<ScheduleEntryPlacement, '_id'>];
  remove: [];
}>();

const machineId = ref('');
const start = ref('');
/** The days field as typed; kept as text so a half-typed value isn't rewritten under the cursor. */
const daysInput = ref('1');

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
    machineId.value = props.initial.machineId;
    start.value = props.initial.start;
    setDays(props.initial.days);
  },
  { immediate: true },
);

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

.schedule-dialog__subtitle {
  white-space: normal;
  line-height: 1.5;
}

.schedule-dialog__start {
  flex: 1 1 180px;
  min-width: 0;
}

/* A native date input won't shrink below its picker's width unless told to. */
.schedule-dialog__start :deep(input) {
  min-width: 0;
}

.schedule-dialog__estimate {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.schedule-dialog__days {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
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
