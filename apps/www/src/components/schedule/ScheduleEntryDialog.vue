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
              :disabled="days <= 1"
              icon="mdi-minus"
              size="small"
              variant="tonal"
              @click="days = Math.max(1, days - 1)"
            />
            <div class="schedule-dialog__days-value">{{ days }} day{{ days === 1 ? '' : 's' }}</div>
            <v-btn
              aria-label="One day longer"
              icon="mdi-plus"
              size="small"
              variant="tonal"
              @click="days += 1"
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
            @click="days = estimate.days"
          >
            Use {{ estimate.days }}d
          </v-btn>
        </div>
        <div v-else-if="estimator" class="text-body-small text-medium-emphasis">
          {{
            op != null
              ? 'This op has no cycle time to estimate from.'
              : 'Booked as a whole job, so there is no op cycle time to estimate from.'
          }}
        </div>
        <div class="text-body-small text-medium-emphasis">
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
import { addDays, isDayKey, type ScheduleEstimate } from '@repo/utilities/schedule';
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
  /** Estimates how long the op runs on a machine from a start day. */
  estimator?: (machineId: string, start: string) => ScheduleEstimate | null;
}>();

const emit = defineEmits<{
  save: [placement: Omit<ScheduleEntryPlacement, '_id'>];
  remove: [];
}>();

const machineId = ref('');
const start = ref('');
const days = ref(1);

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    machineId.value = props.initial.machineId;
    start.value = props.initial.start;
    days.value = props.initial.days;
  },
  { immediate: true },
);

const lastDay = computed(() =>
  isDayKey(start.value) ? addDays(start.value, days.value - 1) : props.initial.start,
);

const estimate = computed(() => {
  if (!props.estimator || !machineId.value || !isDayKey(start.value)) return null;
  return props.estimator(machineId.value, start.value);
});

function formatMinutes(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const canSave = computed(() => Boolean(machineId.value) && isDayKey(start.value));

function save() {
  if (!canSave.value) return;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.schedule-dialog__days-value {
  min-width: 64px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
