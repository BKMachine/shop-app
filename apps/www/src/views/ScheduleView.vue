<template>
  <div :class="['schedule-view', { 'schedule-view--display': display }]">
    <header v-if="display" class="schedule-toolbar schedule-toolbar--display">
      <div class="schedule-toolbar__title">Schedule</div>
      <div class="schedule-toolbar__departments">{{ displayDepartmentsLabel }}</div>
      <span class="schedule-toolbar__range">{{ rangeLabel }}</span>
      <v-spacer />
      <div class="schedule-legend">
        <span class="schedule-legend__item schedule-legend__item--late">Late</span>
        <span class="schedule-legend__item schedule-legend__item--tight">
          Due within {{ SCHEDULE_TIGHT_SLACK_DAYS }}d
        </span>
        <span class="schedule-legend__item schedule-legend__item--ok">On track</span>
      </div>
    </header>
    <header v-else class="schedule-toolbar">
      <div class="schedule-toolbar__title">Schedule</div>

      <div class="schedule-toolbar__group">
        <v-btn
          aria-label="Earlier"
          icon="mdi-chevron-left"
          size="small"
          variant="text"
          @click="shiftRange(-1)"
        />
        <v-btn size="small" variant="tonal" @click="goToToday">Today</v-btn>
        <v-btn
          aria-label="Later"
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          @click="shiftRange(1)"
        />
        <span class="schedule-toolbar__range">{{ rangeLabel }}</span>
      </div>

      <v-btn-toggle
        v-model="preset"
        class="schedule-toolbar__presets"
        density="compact"
        divided
        mandatory
        variant="outlined"
      >
        <v-btn v-for="(config, key) in SCHEDULE_RANGE_PRESETS" :key="key" :value="key">
          {{ config.label }}
        </v-btn>
      </v-btn-toggle>

      <v-spacer />

      <v-menu :close-on-content-click="false" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            :color="hasDepartmentFilter ? 'primary' : undefined"
            prepend-icon="mdi-domain-switch"
            size="small"
            variant="tonal"
          >
            {{ departmentButtonLabel }}
          </v-btn>
        </template>
        <v-list density="compact" min-width="240">
          <v-list-subheader>Included Departments</v-list-subheader>
          <v-list-item v-if="departmentOptions.length">
            <template #prepend>
              <v-checkbox-btn
                :indeterminate="hasDepartmentFilter"
                :model-value="areAllDepartmentsIncluded"
                @update:model-value="toggleAllDepartments(Boolean($event))"
              />
            </template>
            <v-list-item-title>All Departments</v-list-item-title>
          </v-list-item>
          <v-list-item v-for="department in departmentOptions" :key="department">
            <template #prepend>
              <v-checkbox-btn
                :model-value="includedDepartments.includes(department)"
                @update:model-value="toggleDepartment(department, Boolean($event))"
              />
            </template>
            <v-list-item-title>{{ department }}</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="!departmentOptions.length">
            <v-list-item-title>No departments available</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-btn
        :color="backlogOpen ? 'primary' : undefined"
        prepend-icon="mdi-tray-full"
        size="small"
        variant="tonal"
        @click="backlogOpen = !backlogOpen"
      >
        Jobs
        <v-badge
          v-if="unscheduledCount"
          class="ml-2"
          color="warning"
          :content="unscheduledCount"
          inline
        />
        <v-badge
          v-if="hiddenWholeJobCount"
          class="ml-1"
          color="grey"
          :content="`+${hiddenWholeJobCount}`"
          inline
          :title="`${hiddenWholeJobCount} unscheduled whole ${hiddenWholeJobCount === 1 ? 'job' : 'jobs'} hidden (no machine ops in routing)`"
        />
      </v-btn>
    </header>

    <div class="schedule-main">
      <div ref="boardEl" class="schedule-board">
        <div ref="headerEl" class="schedule-board__header">
          <div class="schedule-board__corner">Machine</div>
          <div class="schedule-board__scale" :style="{ width: `${timelineWidth}px` }">
            <div class="schedule-board__months">
              <div
                v-for="month in months"
                :key="month.key"
                class="schedule-board__month"
                :style="{ left: `${month.offset * dayWidth}px`, width: `${month.days * dayWidth}px` }"
              >
                <span>{{ month.label }}</span>
              </div>
            </div>
            <div class="schedule-board__days">
              <div
                v-for="day in dayLabels"
                :key="day.key"
                :class="[
                  'schedule-board__day',
                  {
                    'schedule-board__day--today': day.key === today,
                    'schedule-board__day--weekend': day.weekend,
                  },
                ]"
                :style="{ left: `${day.offset * dayWidth}px`, width: `${day.width}px` }"
              >
                {{ day.label }}
              </div>
            </div>
          </div>
        </div>

        <div class="schedule-board__body">
          <div ref="labelsEl" class="schedule-board__labels">
            <div
              v-for="(machine, row) in visibleMachines"
              :key="machine.id"
              :class="[
                'schedule-board__label',
                { 'schedule-board__label--department-start': departmentBreaks.includes(row) },
                display ? `schedule-board__label--status-${statusTones.get(machine.id) ?? 'none'}` : '',
                { 'schedule-board__label--flash-off': display && flashOffPhase },
                { 'schedule-board__label--mismatch': runningByMachine.get(machine.id)?.mismatch },
                { 'schedule-board__label--blocked': blockedMachineIds.has(machine.id) },
              ]"
              :style="{ height: `${rowHeight}px` }"
            >
              <ScheduleMismatchIcon
                v-if="runningByMachine.get(machine.id)?.mismatch"
                class="schedule-board__mismatch"
                :running-job-numbers="runningByMachine.get(machine.id)?.jobNumbers"
                :scheduled-job-number="runningByMachine.get(machine.id)?.scheduledJobNumber"
              />
              <div class="schedule-board__machine">{{ machine.displayName }}</div>
              <div class="schedule-board__department">{{ machine.department }}</div>
            </div>
          </div>

          <div
            ref="timelineEl"
            class="schedule-board__timeline"
            :class="{ 'schedule-board__timeline--day-lines': dayWidth >= 14 }"
            :style="{
              width: `${timelineWidth}px`,
              height: `${visibleMachines.length * rowHeight}px`,
              '--day-width': `${dayWidth}px`,
              '--row-height': `${rowHeight}px`,
            }"
          >
            <div
              v-for="day in shadedDays"
              :key="day.key"
              :class="[
                'schedule-board__column',
                day.key === today ? 'schedule-board__column--today' : 'schedule-board__column--weekend',
              ]"
              :style="{ left: `${day.offset * dayWidth}px`, width: `${dayWidth}px` }"
            />
            <div
              v-for="row in blockedRows"
              :key="`blocked-${row}`"
              class="schedule-board__row-blocked"
              :style="{ top: `${row * rowHeight}px`, height: `${rowHeight}px` }"
            />
            <div
              v-for="row in departmentBreaks"
              :key="`department-${row}`"
              class="schedule-board__department-line"
              :style="{ top: `${row * rowHeight - 1}px` }"
            />
            <div
              v-for="offset in weekStarts"
              :key="offset"
              class="schedule-board__week-line"
              :style="{ left: `${offset * dayWidth}px` }"
            />
            <div
              v-if="dueMarkerOffset != null"
              class="schedule-board__due-marker"
              :style="{ left: `${dueMarkerOffset * dayWidth}px` }"
            >
              <span>Due</span>
            </div>

            <ScheduleTile
              v-for="tile in tiles"
              :key="tile.entry._id"
              :active="tile.active"
              class="schedule-board__tile"
              :class="{ 'schedule-board__tile--active': tile.active }"
              :clipped-end="tile.clippedEnd"
              :clipped-start="tile.clippedStart"
              :entry="tileEntry(tile.entry)"
              :op-removed="entryOps.get(tile.entry._id)?.removed"
              :resizable="!display"
              :style="{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${tile.width}px`,
                height: `${rowHeight - TILE_INSET * 2}px`,
              }"
              :today="today"
              :width="tile.width"
              @contextmenu.prevent
              @pointerdown="display ? undefined : onTilePointerDown($event, tile.entry)"
            />
          </div>
        </div>

        <div v-if="!visibleMachines.length && !loadingMachines" class="schedule-board__empty">
          No machines in the selected departments.
        </div>
      </div>

      <aside v-if="backlogOpen && !display" class="schedule-backlog">
        <div class="schedule-backlog__header">
          <v-text-field
            v-model="backlogSearch"
            clearable
            density="compact"
            hide-details
            placeholder="Search jobs"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
          />
          <v-chip-group
            v-model="backlogFilters"
            class="schedule-backlog__filters"
            column
            multiple
            selected-class="text-primary"
          >
            <v-chip
              density="comfortable"
              filter
              size="small"
              value="unscheduled"
              variant="outlined"
            >
              Unscheduled
            </v-chip>
            <v-chip
              density="comfortable"
              filter
              size="small"
              title="Jobs with no machine ops in their routing, booked whole"
              value="whole"
              variant="outlined"
            >
              Whole jobs
              <span v-if="wholeJobsInList" class="schedule-backlog__filter-count">
                {{ wholeJobsInList }}
              </span>
            </v-chip>
          </v-chip-group>
          <div class="text-body-small text-medium-emphasis">
            Drag an op onto a machine{{ isTouchDevice ? ' (press and hold)' : '' }}, or tap it.
          </div>
        </div>
        <div class="schedule-backlog__list">
          <div
            v-for="item in backlogItems"
            :key="item.key"
            :class="[
              'schedule-backlog__card',
              { 'schedule-backlog__card--dragging': drag?.kind === 'new' && drag.bookable?.key === item.key },
            ]"
            :style="{ '--customer-color': colorForCustomer(item.job.customerId) }"
            @contextmenu.prevent
            @pointerdown="onBacklogPointerDown($event, item)"
          >
            <div class="schedule-backlog__row">
              <v-icon v-if="item.job.priority === 'rush'" color="error" icon="mdi-fire" size="16" />
              <strong>#{{ item.job.jobNumber }}</strong>
              <span class="schedule-backlog__customer">{{ item.job.customerName }}</span>
              <v-chip
                v-if="item.scheduledCount"
                class="ml-auto"
                density="compact"
                size="x-small"
                variant="tonal"
              >
                {{ item.scheduledCount }}× booked
              </v-chip>
            </div>
            <div class="schedule-backlog__part">
              {{ item.job.partNumber }}
              <span v-if="item.job.partDescription" class="text-medium-emphasis">
                {{ item.job.partDescription }}
              </span>
            </div>
            <div class="schedule-backlog__op">
              <template v-if="item.op != null">
                <strong>Op {{ item.op }}</strong>
                <span v-if="item.operation">{{ item.operation }}</span>
                <span class="text-medium-emphasis">· {{ departmentLabel(item.department) }}</span>
                <span v-if="item.cycleMinutes" class="ml-auto text-medium-emphasis">
                  {{ formatRunHours(item.cycleMinutes * item.job.qty) }}
                </span>
                <span v-else class="ml-auto text-warning">No cycle time</span>
              </template>
              <span v-else class="text-medium-emphasis">Whole job · no machine ops in routing</span>
            </div>
            <div class="schedule-backlog__row text-body-small">
              <span>Qty {{ item.job.qty }}</span>
              <span v-if="item.job.status === 'in_process'" class="text-info">In process</span>
              <span
                v-if="item.job.dueDate"
                class="ml-auto"
                :class="`text-${dueDateColor(item.job.dueDate)}`"
              >
                Due {{ formatDay(item.job.dueDate, { month: 'short', day: 'numeric' }) }}
              </span>
              <span v-else class="ml-auto text-medium-emphasis">No due date</span>
            </div>
          </div>
          <div
            v-if="!backlogItems.length && !hiddenWholeJobsInList"
            class="schedule-backlog__empty"
          >
            {{ backlogJobs.length ? 'Every op shown here is on the schedule.' : 'No open jobs.' }}
          </div>
          <button
            v-if="hiddenWholeJobsInList"
            class="schedule-backlog__hidden"
            type="button"
            @click="showWholeJobs = true"
          >
            <v-icon icon="mdi-eye-off-outline" size="16" />
            {{ hiddenWholeJobsInList }} whole {{ hiddenWholeJobsInList === 1 ? 'job' : 'jobs' }}
            hidden
            <span class="schedule-backlog__hidden-action">Show</span>
          </button>
        </div>
      </aside>
    </div>

    <div
      v-if="drag?.kind === 'new' && drag.active && !drag.preview"
      class="schedule-drag-ghost"
      :style="{ left: `${drag.lastX}px`, top: `${drag.lastY}px` }"
    >
      <ScheduleTile
        active
        :entry="{ job: drag.job, op: drag.bookable?.op, operation: drag.bookable?.operation, start: today, days: 1 }"
        :today="today"
        :width="150"
      />
    </div>

    <ScheduleEntryDialog
      v-if="!display"
      v-model="dialogOpen"
      :entry="dialogEntry"
      :estimator="dialogEstimator"
      :initial="dialogInitial"
      :job="dialogJob"
      :machines="dialogMachines"
      :op="dialogBookable?.op ?? null"
      :op-removed="dialogBookable?.removed"
      :operation="dialogBookable?.operation ?? null"
      @remove="removeDialogEntry"
      @save="saveDialog"
    />
  </div>
</template>

<script setup lang="ts">
import {
  addDays,
  dayKeyOf,
  dayOfWeek,
  diffDays,
  estimateScheduleLength,
  isSchedulableOperation,
  isScheduleWorkday,
  placeScheduleEntry,
  SCHEDULE_TIGHT_SLACK_DAYS,
  type ScheduleEstimate,
  scheduleEnd,
} from '@repo/utilities/schedule';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ScheduleEntryDialog from '@/components/schedule/ScheduleEntryDialog.vue';
import ScheduleMismatchIcon from '@/components/schedule/ScheduleMismatchIcon.vue';
import ScheduleTile from '@/components/schedule/ScheduleTile.vue';
import { dueDateColor } from '@/lib/job_dates';
import { fetchMachineDepartmentOptions } from '@/lib/machineDepartments';
import {
  customerColor,
  formatDay,
  formatRangeLabel,
  isScheduleRangePreset,
  monthSpans,
  SCHEDULE_RANGE_PRESETS,
  type ScheduleRangePreset,
  toScheduleEntryJob,
} from '@/lib/schedule';
import {
  type MachineStatusTone,
  machineStatusTone,
  useMachineStatus,
} from '@/lib/useMachineStatus';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { toastError } from '@/plugins/vue-toast-notification';
import { useCustomerStore } from '@/stores/customer_store';
import useNowStore from '@/stores/now';
import { useScheduleStore } from '@/stores/schedule_store';

const ROW_HEIGHT = 52;
/** Row height limits when display mode stretches the rows to fill the screen. */
const DISPLAY_MIN_ROW_HEIGHT = 28;
const DISPLAY_MAX_ROW_HEIGHT = 84;
const DISPLAY_DEFAULT_DAYS = 14;
const DISPLAY_MAX_DAYS = 182;
/** Display mode reloads this often as well, in case a socket update was missed. */
const DISPLAY_REFRESH_MS = 5 * 60 * 1000;
const TILE_INSET = 4;
/** Narrowest a day column gets; past this the board scrolls sideways instead. */
const MIN_DAY_WIDTH = 4;
/** Pointer travel that turns a mouse press into a drag. */
const MOUSE_DRAG_THRESHOLD_PX = 4;
/** Finger travel before the hold fires that means the user is scrolling, not dragging. */
const TOUCH_SLOP_PX = 10;
const TOUCH_HOLD_MS = 300;
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_SPEED = 18;
const PREVIEW_ID = 'preview';
const BACKLOG_JOB_LIMIT = 200;
const BACKLOG_REFRESH_DEBOUNCE_MS = 500;

const PRESET_STORAGE_KEY = 'schedule-range-preset';
const DEPARTMENTS_STORAGE_KEY = 'schedule-included-departments';
const BACKLOG_STORAGE_KEY = 'schedule-backlog-open';
const WHOLE_JOBS_STORAGE_KEY = 'schedule-show-whole-jobs';

type Placement = Omit<ScheduleEntryPlacement, '_id'>;

/** An op (or a whole job without machine ops) that can be booked, as the job list shows it. */
interface Bookable {
  key: string;
  job: ScheduleEntryJob;
  /** `_id` of the routing op; null for a whole job. */
  routingId: string | null;
  op: number | null;
  operation: string | null;
  /** The op's department `_id`, 'other', or null; it only fits that department's machines. */
  department: string | null;
  cycleMinutes: number | null;
  /** A booked op that is no longer on the part's routing. */
  removed?: boolean;
}

interface DragState {
  kind: 'move' | 'resize' | 'new';
  pointerId: number;
  pointerType: string;
  job: ScheduleEntryJob;
  /** What a drag from the job list will book. */
  bookable: Bookable | null;
  /** Department the booking is limited to; null fits every machine. */
  department: string | null;
  /** The entry being moved or resized; null when dragging a job in from the list. */
  entryId: string | null;
  origin: Placement | null;
  /** Days between the grabbed point and the entry's start. */
  grabOffset: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
  preview: Placement | null;
}

const props = defineProps<{
  /**
   * Read-only wall display: the range is today plus `?days=`, departments come from
   * `?departments=` (comma separated names), and nothing can be moved or opened.
   */
  display?: boolean;
}>();

const route = useRoute();
const scheduleStore = useScheduleStore();
const customerStore = useCustomerStore();
const nowStore = useNowStore();

const today = computed(() => dayKeyOf(nowStore.now));
const isTouchDevice =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/* ---------- Range ---------- */

const preset = ref<ScheduleRangePreset>(readPreset());
// Every range starts at today; the arrows move back to see earlier work.
const rangeStart = ref(today.value);

/** `?days=` for display mode. */
const displayDays = computed(() => {
  const days = Number.parseInt(String(route.query.days ?? ''), 10);
  if (!Number.isFinite(days)) return DISPLAY_DEFAULT_DAYS;
  return Math.min(Math.max(days, 1), DISPLAY_MAX_DAYS);
});

const rangeDays = computed(() =>
  props.display ? displayDays.value : SCHEDULE_RANGE_PRESETS[preset.value].days,
);

// A wall display always starts at today, so it moves on by itself at midnight.
watch(today, (day) => {
  if (props.display) rangeStart.value = day;
});
const rangeEnd = computed(() => addDays(rangeStart.value, rangeDays.value));
const rangeLabel = computed(() => formatRangeLabel(rangeStart.value, rangeDays.value));

watch(preset, (value) => {
  window.localStorage.setItem(PRESET_STORAGE_KEY, value);
  rangeStart.value = today.value;
});

function shiftRange(direction: 1 | -1) {
  rangeStart.value = addDays(
    rangeStart.value,
    direction * SCHEDULE_RANGE_PRESETS[preset.value].step,
  );
}

function goToToday() {
  rangeStart.value = today.value;
}

function readPreset(): ScheduleRangePreset {
  const stored = window.localStorage.getItem(PRESET_STORAGE_KEY);
  return isScheduleRangePreset(stored) ? stored : '1m';
}

/* ---------- Board geometry ---------- */

const boardEl = ref<HTMLElement | null>(null);
const labelsEl = ref<HTMLElement | null>(null);
const timelineEl = ref<HTMLElement | null>(null);
const headerEl = ref<HTMLElement | null>(null);
const availableHeight = ref(0);
const availableWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

// Rounded down to a hundredth of a pixel so the days never add up to a sliver of sideways scroll.
const dayWidth = computed(() =>
  Math.max(
    MIN_DAY_WIDTH,
    Math.floor((availableWidth.value / Math.max(rangeDays.value, 1)) * 100) / 100,
  ),
);
const timelineWidth = computed(() => dayWidth.value * rangeDays.value);

function measureBoard() {
  if (!boardEl.value) return;
  const labelsWidth = labelsEl.value?.offsetWidth ?? 0;
  availableWidth.value = Math.max(0, boardEl.value.clientWidth - labelsWidth);
  availableHeight.value = Math.max(
    0,
    boardEl.value.clientHeight - (headerEl.value?.offsetHeight ?? 0),
  );
}

/** Fixed in the app; on a wall display the rows stretch to fill the screen. */
const rowHeight = computed(() => {
  if (!props.display || !visibleMachines.value.length) return ROW_HEIGHT;
  const fit = Math.floor(availableHeight.value / visibleMachines.value.length);
  return Math.min(Math.max(fit, DISPLAY_MIN_ROW_HEIGHT), DISPLAY_MAX_ROW_HEIGHT);
});

const months = computed(() => monthSpans(rangeStart.value, rangeDays.value));

const rangeDayKeys = computed(() =>
  Array.from({ length: rangeDays.value }, (_, offset) => ({
    key: addDays(rangeStart.value, offset),
    offset,
  })),
);

const dayLabels = computed(() => {
  const width = dayWidth.value;
  return rangeDayKeys.value.flatMap(({ key, offset }) => {
    const weekday = dayOfWeek(key);
    const weekend = !isScheduleWorkday(key, scheduleStore.settings);
    const date = Number(key.slice(8));
    if (width >= 44) {
      const label = `${formatDay(key, { weekday: 'short' })} ${date}`;
      return [{ key, offset, width, weekend, label }];
    }
    if (width >= 20) return [{ key, offset, width, weekend, label: String(date) }];
    // Too narrow for every day: label each Monday across its week.
    if (weekday !== 1) return [];
    return [{ key, offset, width: width * 7, weekend: false, label: String(date) }];
  });
});

/** Today and the days off, which get their own column shading. */
const shadedDays = computed(() =>
  rangeDayKeys.value.filter(
    ({ key }) => key === today.value || !isScheduleWorkday(key, scheduleStore.settings),
  ),
);

const weekStarts = computed(() =>
  rangeDayKeys.value.filter(({ key }) => dayOfWeek(key) === 1).map(({ offset }) => offset),
);

/* ---------- Running jobs vs the schedule ---------- */

interface RunningJobs {
  jobNumbers: number[];
  scheduledJobNumber: number | null;
  /** A job running on the machine is not today's booking. */
  mismatch: boolean;
}

const runningByMachine = ref(new Map<string, RunningJobs>());
let runningRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchRunningJobs() {
  try {
    const { data } = await api.get<MachineJobDashboardResponse>('/jobs/machine-dashboard');
    const next = new Map<string, RunningJobs>();
    for (const row of data.active) {
      const entry = next.get(row.machineId) ?? {
        jobNumbers: [],
        scheduledJobNumber: row.scheduledJobNumber ?? null,
        mismatch: false,
      };
      if (row.jobNumber != null) entry.jobNumbers.push(row.jobNumber);
      entry.mismatch = entry.mismatch || Boolean(row.scheduleMismatch);
      next.set(row.machineId, entry);
    }
    runningByMachine.value = next;
  } catch (error) {
    console.warn('Unable to load running jobs.', error);
  }
}

/** Running jobs and bookings both change the comparison; batch bursts of updates into one load. */
function refreshRunningJobs() {
  if (runningRefreshTimer) clearTimeout(runningRefreshTimer);
  runningRefreshTimer = setTimeout(() => {
    runningRefreshTimer = null;
    void fetchRunningJobs();
  }, 500);
}

const RUNNING_JOB_EVENTS = ['schedule', 'job', 'jobDeleted', 'part'] as const;

/* ---------- Machine status (wall display) ---------- */

const { machines: liveMachines } = useMachineStatus(() => Boolean(props.display));

/** Each machine's status colour, re-evaluated every second so a long red starts to flash. */
const statusTones = computed(() => {
  const tones = new Map<string, MachineStatusTone>();
  if (!props.display) return tones;
  for (const [id, machine] of liveMachines.value) {
    tones.set(id, machineStatusTone(machine, nowStore.now));
  }
  return tones;
});

/** Odd seconds dim a flashing status, in step with the status tiles. */
const flashOffPhase = computed(() => Math.floor(nowStore.now.valueOf() / 1000) % 2 === 1);

/* ---------- Machines & departments ---------- */

const machines = ref<MachineConfig[]>([]);
const loadingMachines = ref(true);
const departmentOptions = ref<string[]>([]);
const includedDepartments = ref<string[]>(readStringList(DEPARTMENTS_STORAGE_KEY));

const areAllDepartmentsIncluded = computed(
  () =>
    departmentOptions.value.length > 0 &&
    departmentOptions.value.every((department) => includedDepartments.value.includes(department)),
);
const hasDepartmentFilter = computed(
  () => departmentOptions.value.length > 0 && !areAllDepartmentsIncluded.value,
);
const departmentButtonLabel = computed(() => {
  if (!hasDepartmentFilter.value) return 'All Departments';
  if (includedDepartments.value.length === 1) return includedDepartments.value[0];
  return `${includedDepartments.value.length} Departments`;
});

const visibleMachines = computed(() => {
  if (!departmentOptions.value.length || areAllDepartmentsIncluded.value) return machines.value;
  const included = new Set(includedDepartments.value);
  return machines.value.filter((machine) => included.has(machine.department.trim()));
});

/** Rows where a new department starts, below the first. */
const departmentBreaks = computed(() =>
  visibleMachines.value.flatMap((machine, row) =>
    row > 0 && machine.department !== visibleMachines.value[row - 1]?.department ? [row] : [],
  ),
);

const machineRowIndex = computed(
  () => new Map(visibleMachines.value.map((machine, index) => [machine.id, index])),
);

function toggleDepartment(department: string, included: boolean) {
  const next = new Set(includedDepartments.value);
  if (included) next.add(department);
  else next.delete(department);
  includedDepartments.value = departmentOptions.value.filter((option) => next.has(option));
  persistDepartments();
}

function toggleAllDepartments(included: boolean) {
  includedDepartments.value = included ? [...departmentOptions.value] : [];
  persistDepartments();
}

function persistDepartments() {
  window.localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(includedDepartments.value));
}

function readStringList(storageKey: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

/** Alphabetical by department, then by machine; machines without a department go last. */
function orderMachines(list: MachineConfig[]): MachineConfig[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...list].sort((left, right) => {
    const leftDepartment = left.department.trim();
    const rightDepartment = right.department.trim();
    if (!leftDepartment !== !rightDepartment) return leftDepartment ? -1 : 1;
    return (
      collator.compare(leftDepartment, rightDepartment) ||
      collator.compare(left.displayName || left.name, right.displayName || right.name)
    );
  });
}

/** `?departments=` names, matched without regard to case; none given means every department. */
const queryDepartments = computed(() =>
  [route.query.departments]
    .flat()
    .flatMap((value) => String(value ?? '').split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function applyDepartmentQuery() {
  const wanted = queryDepartments.value;
  includedDepartments.value = wanted.length
    ? departmentOptions.value.filter((department) => wanted.includes(department.toLowerCase()))
    : [...departmentOptions.value];
}

watch(queryDepartments, () => {
  if (props.display) applyDepartmentQuery();
});

const displayDepartmentsLabel = computed(() =>
  areAllDepartmentsIncluded.value ? 'All Departments' : includedDepartments.value.join(' · '),
);

async function fetchMachines() {
  loadingMachines.value = true;
  try {
    const [{ data }, departments] = await Promise.all([
      api.get<MachineConfig[]>('/machines'),
      fetchMachineDepartmentOptions(),
    ]);
    machines.value = orderMachines(data);
    departmentOptions.value = departments;
    if (props.display) {
      applyDepartmentQuery();
      return;
    }
    const known = includedDepartments.value.filter((department) =>
      departments.includes(department),
    );
    includedDepartments.value = known.length ? known : [...departments];
    persistDepartments();
  } catch (error) {
    console.error('Error fetching machines:', error);
    toastError('Failed to load machines');
  } finally {
    loadingMachines.value = false;
  }
}

/* ---------- Schedule entries ---------- */

/** Load from today even when looking ahead, so the job list knows what is already booked. */
const fetchFrom = computed(() =>
  diffDays(rangeStart.value, today.value) < 0 ? today.value : rangeStart.value,
);

watch(fetchFrom, (from) => void scheduleStore.fetch(from).catch(() => undefined), {
  immediate: true,
});

/** The entries as they would be with the drag in progress dropped where it is. */
const displayEntries = computed<ScheduleEntry[]>(() => {
  const entries = scheduleStore.entries;
  const state = drag.value;
  if (!state?.active || !state.preview) return entries;

  if (state.kind === 'new') {
    const draft: ScheduleEntry = {
      _id: PREVIEW_ID,
      job: state.job,
      op: state.bookable?.op ?? null,
      operation: state.bookable?.operation ?? null,
      ...state.preview,
    };
    return placeScheduleEntry([...entries, draft], draft);
  }
  if (!state.entryId) return entries;
  return placeScheduleEntry(entries, { _id: state.entryId, ...state.preview });
});

const tiles = computed(() => {
  const width = dayWidth.value;
  const activeId = drag.value?.active
    ? (drag.value.entryId ?? PREVIEW_ID)
    : dialogOpen.value
      ? dialogEntry.value?._id
      : undefined;

  return displayEntries.value.flatMap((entry) => {
    const row = machineRowIndex.value.get(entry.machineId);
    if (row == null) return [];
    if (diffDays(entry.start, rangeEnd.value) <= 0) return [];
    if (diffDays(rangeStart.value, scheduleEnd(entry)) <= 0) return [];

    // Tiles running past either edge are cut to the visible range so their label stays in view.
    const rawLeft = diffDays(rangeStart.value, entry.start) * width;
    const rawRight = rawLeft + entry.days * width;
    const left = Math.max(rawLeft, 0);
    const right = Math.min(rawRight, timelineWidth.value);

    return [
      {
        entry,
        active: entry._id === activeId,
        left: left + 1,
        width: Math.max(right - left - 2, 3),
        clippedStart: rawLeft < 0,
        clippedEnd: rawRight > timelineWidth.value,
        top: row * rowHeight.value + TILE_INSET,
      },
    ];
  });
});

/** Where the due date of the job being dragged or edited falls, as days into the range. */
const dueMarkerOffset = computed(() => {
  const job = drag.value?.active ? drag.value.job : dialogOpen.value ? dialogJob.value : null;
  if (!job?.dueDate) return null;
  const offset = diffDays(rangeStart.value, job.dueDate) + 1;
  return offset > 0 && offset <= rangeDays.value ? offset : null;
});

/* ---------- Job list ---------- */

const backlogOpen = ref(window.localStorage.getItem(BACKLOG_STORAGE_KEY) !== 'false');
const backlogJobs = ref<ScheduleEntryJob[]>([]);
/** Each open job's part routing, for estimating how long a booking runs. */
const routingByJob = ref(new Map<string, RoutingOperation[]>());
const backlogSearch = ref('');
const hideScheduled = ref(true);
/**
 * Jobs with no machine ops in their routing are booked whole. They are mostly routing that hasn't
 * been filled in yet, so the list leaves them out unless asked.
 */
const showWholeJobs = ref(window.localStorage.getItem(WHOLE_JOBS_STORAGE_KEY) === 'true');
let backlogRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/** The job list's filter chips, as the chip group selects them. */
const backlogFilters = computed({
  get: () => [
    ...(hideScheduled.value ? ['unscheduled'] : []),
    ...(showWholeJobs.value ? ['whole'] : []),
  ],
  set: (selected: string[]) => {
    hideScheduled.value = selected.includes('unscheduled');
    showWholeJobs.value = selected.includes('whole');
  },
});

watch(showWholeJobs, (show) => window.localStorage.setItem(WHOLE_JOBS_STORAGE_KEY, String(show)));

watch(backlogOpen, (open) => {
  window.localStorage.setItem(BACKLOG_STORAGE_KEY, String(open));
  requestAnimationFrame(measureBoard);
});

/** Identifies an op across bookings: by its routing id, by op number without one, or the job. */
function bookableKey(
  jobId: string,
  routingId: string | null | undefined,
  op: number | null | undefined,
) {
  if (routingId) return `${jobId}:${routingId}`;
  return op != null ? `${jobId}:op${op}` : `${jobId}:job`;
}

/** How many times each op (or whole job) is booked, by bookable key. */
const scheduledCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const entry of scheduleStore.entries) {
    const key = bookableKey(entry.job._id, entry.routingId, entry.op);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
});

/** Every op that runs on a machine gets its own card; a job without any is booked whole. */
const bookables = computed<Bookable[]>(() =>
  backlogJobs.value.flatMap((job): Bookable[] => {
    const ops = (routingByJob.value.get(job._id) ?? []).filter(isSchedulableOperation);
    if (!ops.length) {
      return [
        {
          key: bookableKey(job._id, null, null),
          job,
          routingId: null,
          op: null,
          operation: null,
          department: null,
          cycleMinutes: null,
        },
      ];
    }
    return ops.map((operation) => ({
      key: bookableKey(job._id, operation._id, operation.op),
      job,
      routingId: operation._id ?? null,
      op: operation.op,
      operation: operation.operation?.trim() || null,
      department: operation.department ?? null,
      cycleMinutes: Number(operation.time) > 0 ? Number(operation.time) : null,
    }));
  }),
);

/** With a department filter on, only ops that fit a machine shown (and whole jobs) are listed. */
const departmentBookables = computed(() =>
  hasDepartmentFilter.value
    ? bookables.value.filter(
        (item) =>
          item.op == null ||
          (item.department != null &&
            departmentTypes.value.has(item.department) &&
            visibleMachines.value.some((machine) => fitsMachine(item.department, machine))),
      )
    : bookables.value,
);

const unscheduledBookables = computed(() =>
  departmentBookables.value.filter((item) => !scheduledCounts.value.has(item.key)),
);

const unscheduledCount = computed(
  () => unscheduledBookables.value.filter((item) => showWholeJobs.value || item.op != null).length,
);

/** Unscheduled whole jobs left out of the list while whole jobs are hidden. */
const hiddenWholeJobCount = computed(() =>
  showWholeJobs.value ? 0 : unscheduledBookables.value.filter((item) => item.op == null).length,
);

/** The list's cards by its search and filters, whole jobs included. */
const matchingBookables = computed(() => {
  const search = backlogSearch.value?.trim().toLowerCase() ?? '';
  return departmentBookables.value
    .map((item) => ({ ...item, scheduledCount: scheduledCounts.value.get(item.key) ?? 0 }))
    .filter(({ job, operation, scheduledCount }) => {
      if (hideScheduled.value && scheduledCount) return false;
      if (!search) return true;
      return [
        String(job.jobNumber),
        job.customerName,
        job.partNumber,
        job.partDescription,
        operation ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
});

/** Whole jobs matching the list's search and filters. */
const wholeJobsInList = computed(
  () => matchingBookables.value.filter((item) => item.op == null).length,
);

const hiddenWholeJobsInList = computed(() => (showWholeJobs.value ? 0 : wholeJobsInList.value));

const backlogItems = computed(() =>
  showWholeJobs.value
    ? matchingBookables.value
    : matchingBookables.value.filter((item) => item.op != null),
);

const departmentNames = computed(
  () =>
    new Map(
      machines.value
        .filter((machine) => machine.departmentId)
        .map((machine) => [machine.departmentId as string, machine.department]),
    ),
);

function departmentLabel(department: string | null) {
  if (!department) return 'No department';
  if (department === 'other') return 'Other';
  return departmentNames.value.get(department) ?? 'Unknown department';
}

function formatRunHours(minutes: number) {
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} h`;
}

/** The machine types in each department, e.g. Robodrill → mill. */
const departmentTypes = computed(() => {
  const types = new Map<string, Set<MachineType>>();
  for (const machine of machines.value) {
    if (!machine.departmentId) continue;
    const set = types.get(machine.departmentId) ?? new Set<MachineType>();
    set.add(machine.type);
    types.set(machine.departmentId, set);
  }
  return types;
});

/**
 * Whether a booking for an op in `department` can go on `machine`: any machine of the same type
 * as that department's machines, so a 3 Axis op also fits the Robodrills and DTs. Ops in 'Other'
 * or in a department no machine belongs to are not held to one.
 */
function fitsMachine(department: string | null | undefined, machine: MachineConfig) {
  const types = department ? departmentTypes.value.get(department) : undefined;
  return !types || types.has(machine.type);
}

async function fetchBacklog() {
  try {
    const { data } = await api.get<JobListResponse>('/jobs', {
      params: {
        status: 'not_closed',
        sort: 'dueDate',
        order: 'asc',
        limit: BACKLOG_JOB_LIMIT,
      },
    });
    const jobs = data.items.filter((job) => job.status !== 'machining_complete');
    backlogJobs.value = jobs.map(toScheduleEntryJob);
    routingByJob.value = new Map(
      jobs.map((job) => [job._id, typeof job.part === 'string' ? [] : (job.part.routing ?? [])]),
    );
  } catch (error) {
    console.error('Error fetching jobs:', error);
    toastError('Failed to load jobs');
  }
}

function refreshBacklog() {
  if (backlogRefreshTimer) clearTimeout(backlogRefreshTimer);
  backlogRefreshTimer = setTimeout(() => {
    backlogRefreshTimer = null;
    void fetchBacklog();
  }, BACKLOG_REFRESH_DEBOUNCE_MS);
}

const customerColors = computed(
  () => new Map(customerStore.customers.map((customer) => [customer._id, customer.color])),
);

function colorForCustomer(customerId: string) {
  return customerColor(customerColors.value.get(customerId));
}

/** An op's cycle minutes; null for an untimed op or one without a time. */
function cycleMinutesOf(operation: RoutingOperation): number | null {
  return isSchedulableOperation(operation) && Number(operation.time) > 0
    ? Number(operation.time)
    : null;
}

/** How long an op would run on `machineId` from `start`; null without a cycle time to go on. */
function estimateFor(
  job: ScheduleEntryJob,
  cycleMinutes: number | null,
  machineId: string,
  start: string,
): ScheduleEstimate | null {
  return estimateScheduleLength({
    cycleMinutes,
    qty: job.qty,
    departmentId: machines.value.find((machine) => machine.id === machineId)?.departmentId,
    start,
    settings: scheduleStore.settings,
  });
}

/* ---------- Dialog ---------- */

const dialogOpen = ref(false);
const dialogEntry = ref<ScheduleEntry | null>(null);
const dialogJob = ref<ScheduleEntryJob | null>(null);
const dialogInitial = ref<Placement>({ machineId: '', start: today.value, days: 1 });
/** The op being booked or edited, with what its estimate and machines depend on. */
const dialogBookable = ref<Bookable | null>(null);

/** Machines the dialog offers: those the op fits, preferring the ones on screen. */
const dialogMachines = computed(() => {
  const department = dialogBookable.value?.department;
  const fitting = (list: MachineConfig[]) =>
    list.filter((machine) => fitsMachine(department, machine));
  const visible = fitting(visibleMachines.value);
  return visible.length ? visible : fitting(machines.value);
});

const dialogEstimator = computed(() => {
  const bookable = dialogBookable.value;
  if (!bookable) return undefined;
  return (machineId: string, start: string) =>
    estimateFor(bookable.job, bookable.cycleMinutes, machineId, start);
});

/**
 * The op a booking is for, as the part's routing has it now: found by its routing id, so a booked
 * op that was renumbered shows its new number and name. Falls back to what was saved with the
 * booking when the job's routing isn't loaded (closed jobs), and flags an op that was removed.
 */
function bookableForEntry(entry: ScheduleEntry): Bookable {
  const saved: Bookable = {
    key: bookableKey(entry.job._id, entry.routingId, entry.op),
    job: entry.job,
    routingId: entry.routingId ?? null,
    op: entry.op ?? null,
    operation: entry.operation ?? null,
    department: entry.department ?? null,
    cycleMinutes: null,
  };
  if (entry.op == null && !entry.routingId) return saved;

  const routing = routingByJob.value.get(entry.job._id);
  if (!routing) return saved;
  const operation = entry.routingId
    ? routing.find((candidate) => candidate._id === entry.routingId)
    : routing.find((candidate) => candidate.op === entry.op);
  if (!operation) return { ...saved, removed: true };

  return {
    ...saved,
    op: operation.op,
    operation: operation.operation?.trim() || null,
    department: operation.department ?? null,
    cycleMinutes: cycleMinutesOf(operation),
  };
}

/** Each booking's op as the routing has it now, by booking id. */
const entryOps = computed(
  () => new Map(scheduleStore.entries.map((entry) => [entry._id, bookableForEntry(entry)])),
);

/** A booking with its op's current number and name, for showing on a tile. */
function tileEntry(entry: ScheduleEntry) {
  const current = entryOps.value.get(entry._id);
  return current ? { ...entry, op: current.op, operation: current.operation } : entry;
}

function openEntryDialog(entry: ScheduleEntry) {
  dialogEntry.value = entry;
  dialogJob.value = entry.job;
  dialogBookable.value = bookableForEntry(entry);
  dialogInitial.value = { machineId: entry.machineId, start: entry.start, days: entry.days };
  dialogOpen.value = true;
}

function openNewBookingDialog(bookable: Bookable) {
  dialogEntry.value = null;
  dialogJob.value = bookable.job;
  dialogBookable.value = bookable;
  const machineId = dialogMachines.value[0]?.id ?? '';
  const start = nextOpenDay(machineId);
  dialogInitial.value = newBookingPlacement(bookable, machineId, start);
  dialogOpen.value = true;
}

/** The first day from today with nothing booked after it on the machine. */
function nextOpenDay(machineId: string): string {
  return scheduleStore.entries
    .filter((entry) => entry.machineId === machineId)
    .map(scheduleEnd)
    .reduce((latest, end) => (diffDays(latest, end) > 0 ? end : latest), today.value);
}

async function saveDialog(placement: Placement) {
  dialogOpen.value = false;
  try {
    if (dialogEntry.value) {
      await scheduleStore.place({ _id: dialogEntry.value._id, ...placement });
    } else if (dialogBookable.value) {
      await scheduleStore.add(dialogBookable.value.job, placement, bookingOp(dialogBookable.value));
    }
  } catch {
    // The store has already reported the failure and reloaded.
  }
}

async function removeDialogEntry() {
  const entry = dialogEntry.value;
  dialogOpen.value = false;
  if (!entry) return;
  try {
    await scheduleStore.remove(entry._id);
  } catch {
    // The store has already reported the failure and restored the entry.
  }
}

/* ---------- Dragging (mouse, pen and touch) ---------- */

const drag = ref<DragState | null>(null);
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let autoScrollFrame: number | null = null;

function onTilePointerDown(event: PointerEvent, entry: ScheduleEntry) {
  if (drag.value || (event.pointerType === 'mouse' && event.button !== 0)) return;
  if (entry._id === PREVIEW_ID || entry._id.startsWith('draft:')) return;

  const resizing = Boolean((event.target as Element).closest('.schedule-tile__resize'));
  const pointerDay = dayAtPointer(event.clientX);
  beginPointer(event, {
    kind: resizing ? 'resize' : 'move',
    job: entry.job,
    bookable: null,
    department: entryOps.value.get(entry._id)?.department ?? entry.department ?? null,
    entryId: entry._id,
    origin: { machineId: entry.machineId, start: entry.start, days: entry.days },
    grabOffset: pointerDay - diffDays(rangeStart.value, entry.start),
  });

  // The resize handle is a deliberate target, so it drags at once even under a finger.
  if (resizing) {
    event.preventDefault();
    activateDrag();
  }
}

function onBacklogPointerDown(event: PointerEvent, bookable: Bookable) {
  if (drag.value || (event.pointerType === 'mouse' && event.button !== 0)) return;
  beginPointer(event, {
    kind: 'new',
    job: bookable.job,
    bookable,
    department: bookable.department,
    entryId: null,
    origin: null,
    grabOffset: 0,
  });
}

function beginPointer(
  event: PointerEvent,
  fields: Pick<
    DragState,
    'kind' | 'job' | 'bookable' | 'department' | 'entryId' | 'origin' | 'grabOffset'
  >,
) {
  drag.value = {
    ...fields,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    active: false,
    preview: null,
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('keydown', onKeyDown);

  // A finger has to hold still before it drags, so a swipe over the board still scrolls it.
  if (event.pointerType === 'touch') {
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (drag.value && !drag.value.active) activateDrag();
    }, TOUCH_HOLD_MS);
  }
}

function activateDrag() {
  const state = drag.value;
  if (!state) return;
  state.active = true;
  if (state.pointerType === 'touch') navigator.vibrate?.(15);
  document.body.classList.add('schedule-dragging');
  updatePreview();
  startAutoScroll();
}

function onPointerMove(event: PointerEvent) {
  const state = drag.value;
  if (!state || event.pointerId !== state.pointerId) return;
  state.lastX = event.clientX;
  state.lastY = event.clientY;

  if (state.active) {
    updatePreview();
    return;
  }

  const travel = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
  if (state.pointerType === 'touch') {
    if (travel > TOUCH_SLOP_PX) endDrag();
  } else if (travel > MOUSE_DRAG_THRESHOLD_PX) {
    activateDrag();
  }
}

function onPointerUp(event: PointerEvent) {
  const state = drag.value;
  if (!state || event.pointerId !== state.pointerId) return;

  if (state.active) {
    commitDrag(state);
  } else if (state.entryId) {
    const entry = scheduleStore.entries.find((candidate) => candidate._id === state.entryId);
    if (entry) openEntryDialog(entry);
  } else if (state.bookable) {
    openNewBookingDialog(state.bookable);
  }
  endDrag();
}

function onPointerCancel(event: PointerEvent) {
  if (drag.value && event.pointerId === drag.value.pointerId) endDrag();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') endDrag();
}

/** Stops a touch drag from scrolling the page; must be a non-passive listener to be allowed to. */
function preventTouchScroll(event: TouchEvent) {
  if (drag.value?.active && event.cancelable) event.preventDefault();
}

function endDrag() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (autoScrollFrame != null) {
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  window.removeEventListener('keydown', onKeyDown);
  document.body.classList.remove('schedule-dragging');
  drag.value = null;
}

function commitDrag(state: DragState) {
  const { preview } = state;
  if (!preview) return;

  if (state.kind === 'new') {
    if (state.bookable) {
      void scheduleStore.add(state.job, preview, bookingOp(state.bookable)).catch(() => undefined);
    }
    return;
  }

  const { origin, entryId } = state;
  if (!entryId || !origin) return;
  const unchanged =
    origin.machineId === preview.machineId &&
    origin.start === preview.start &&
    origin.days === preview.days;
  if (unchanged) return;
  void scheduleStore.place({ _id: entryId, ...preview }).catch(() => undefined);
}

function dayAtPointer(clientX: number): number {
  const rect = timelineEl.value?.getBoundingClientRect();
  if (!rect) return 0;
  return Math.floor((clientX - rect.left) / dayWidth.value);
}

function isOverBoard(clientX: number, clientY: number): boolean {
  const rect = boardEl.value?.getBoundingClientRect();
  if (!rect) return false;
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function updatePreview() {
  const state = drag.value;
  const rect = timelineEl.value?.getBoundingClientRect();
  if (!state?.active || !rect || !visibleMachines.value.length) return;

  const day = Math.floor((state.lastX - rect.left) / dayWidth.value);
  const row = Math.min(
    Math.max(Math.floor((state.lastY - rect.top) / rowHeight.value), 0),
    visibleMachines.value.length - 1,
  );
  const target = visibleMachines.value[row];
  if (!target) return;
  const fits = blockedMachineIds.value.has(target.id) === false;
  const machineId = target.id;

  if (state.kind === 'resize' && state.origin) {
    const startOffset = diffDays(rangeStart.value, state.origin.start);
    state.preview = { ...state.origin, days: Math.max(1, day - startOffset + 1) };
    return;
  }

  if (state.kind === 'move' && state.origin) {
    // Over a machine the op doesn't fit, it keeps to the last machine it could go on.
    state.preview = {
      machineId: fits ? machineId : (state.preview?.machineId ?? state.origin.machineId),
      start: addDays(rangeStart.value, day - state.grabOffset),
      days: state.origin.days,
    };
    return;
  }

  // A job from the list only lands once it is over the board; elsewhere it just follows along.
  const overTimeline = state.lastX >= rect.left && state.lastY >= rect.top;
  state.preview =
    isOverBoard(state.lastX, state.lastY) && overTimeline && fits
      ? newBookingPlacement(state.bookable, machineId, addDays(rangeStart.value, day))
      : null;
}

function newBookingPlacement(
  bookable: Bookable | null,
  machineId: string,
  start: string,
): Placement {
  const estimate = bookable
    ? estimateFor(bookable.job, bookable.cycleMinutes, machineId, start)
    : null;
  return { machineId, start, days: estimate?.days ?? 1 };
}

/** The op details a new booking is saved with. */
function bookingOp(bookable: Bookable) {
  return {
    routingId: bookable.routingId,
    op: bookable.op,
    operation: bookable.operation,
    department: bookable.department,
  };
}

/** Machines the op being dragged can't go on, greyed out while it is held. */
const blockedMachineIds = computed(() => {
  const state = drag.value;
  if (!state?.active || state.kind === 'resize') return new Set<string>();
  return new Set(
    visibleMachines.value
      .filter((machine) => !fitsMachine(state.department, machine))
      .map((machine) => machine.id),
  );
});

const blockedRows = computed(() =>
  visibleMachines.value.flatMap((machine, row) =>
    blockedMachineIds.value.has(machine.id) ? [row] : [],
  ),
);

/** Scrolls the board while a drag is held near its edge. */
function startAutoScroll() {
  const step = () => {
    const state = drag.value;
    const board = boardEl.value;
    if (!state?.active || !board) {
      autoScrollFrame = null;
      return;
    }

    const rect = board.getBoundingClientRect();
    const labelsWidth = labelsEl.value?.offsetWidth ?? 0;
    const headerHeight = timelineEl.value
      ? timelineEl.value.getBoundingClientRect().top - rect.top + board.scrollTop
      : 0;
    const speed = (distance: number) =>
      Math.round(AUTO_SCROLL_MAX_SPEED * (1 - Math.max(distance, 0) / AUTO_SCROLL_EDGE_PX));

    let dx = 0;
    let dy = 0;
    if (isOverBoard(state.lastX, state.lastY) || state.kind !== 'new') {
      const fromTop = state.lastY - (rect.top + headerHeight);
      const fromBottom = rect.bottom - state.lastY;
      const fromLeft = state.lastX - (rect.left + labelsWidth);
      const fromRight = rect.right - state.lastX;
      if (fromTop < AUTO_SCROLL_EDGE_PX) dy = -speed(fromTop);
      else if (fromBottom < AUTO_SCROLL_EDGE_PX) dy = speed(fromBottom);
      if (fromLeft < AUTO_SCROLL_EDGE_PX) dx = -speed(fromLeft);
      else if (fromRight < AUTO_SCROLL_EDGE_PX) dx = speed(fromRight);
    }

    if (dx || dy) {
      const { scrollLeft, scrollTop } = board;
      board.scrollBy(dx, dy);
      if (board.scrollLeft !== scrollLeft || board.scrollTop !== scrollTop) updatePreview();
    }
    autoScrollFrame = requestAnimationFrame(step);
  };
  autoScrollFrame = requestAnimationFrame(step);
}

/* ---------- Lifecycle ---------- */

let displayRefreshTimer: ReturnType<typeof setInterval> | null = null;

/** Catches up after the socket reconnects, or on the display's safety interval. */
function refreshDisplay() {
  scheduleStore.refresh();
  void scheduleStore.fetchSettings().catch(() => undefined);
  refreshRunningJobs();
}

onMounted(() => {
  void fetchMachines().then(() => requestAnimationFrame(measureBoard));
  scheduleStore.listen();
  void scheduleStore.fetchSettings().catch(() => undefined);
  void fetchRunningJobs();
  for (const event of RUNNING_JOB_EVENTS) socket.on(event, refreshRunningJobs);

  if (props.display) {
    socket.io.on('reconnect', refreshDisplay);
    displayRefreshTimer = setInterval(refreshDisplay, DISPLAY_REFRESH_MS);
  } else {
    void fetchBacklog();
    socket.on('job', refreshBacklog);
    socket.on('jobDeleted', refreshBacklog);
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
  }

  measureBoard();
  resizeObserver = new ResizeObserver(measureBoard);
  if (boardEl.value) resizeObserver.observe(boardEl.value);
});

onBeforeUnmount(() => {
  endDrag();
  scheduleStore.stopListening();
  socket.off('job', refreshBacklog);
  socket.off('jobDeleted', refreshBacklog);
  document.removeEventListener('touchmove', preventTouchScroll);
  resizeObserver?.disconnect();
  if (backlogRefreshTimer) clearTimeout(backlogRefreshTimer);
  socket.io.off('reconnect', refreshDisplay);
  for (const event of RUNNING_JOB_EVENTS) socket.off(event, refreshRunningJobs);
  if (runningRefreshTimer) clearTimeout(runningRefreshTimer);
  if (displayRefreshTimer) clearInterval(displayRefreshTimer);
});
</script>

<style scoped>
.schedule-view {
  --schedule-label-width: 160px;
  --schedule-divider: rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--v-layout-top, 64px));
  min-height: 0;
}

.schedule-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--schedule-divider);
}

.schedule-view--display {
  /* Wider names column to make room for the status strip. */
  --schedule-label-width: 180px;
  height: 100dvh;
}

.schedule-view--display .schedule-board {
  overflow: hidden;
}

.schedule-view--display .schedule-board__tile {
  cursor: default;
}

.schedule-toolbar--display {
  padding: 8px 16px;
}

.schedule-toolbar__departments {
  font-size: 1.1rem;
  font-weight: 600;
}

.schedule-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.85rem;
}

.schedule-legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.schedule-legend__item::before {
  content: "";
  width: 18px;
  height: 12px;
  border: 3px solid currentColor;
  border-radius: 3px;
}

.schedule-legend__item--late::before {
  color: rgb(var(--v-theme-error));
}

.schedule-legend__item--tight::before {
  color: rgb(var(--v-theme-warning));
}

.schedule-legend__item--ok::before {
  border-width: 2px;
  color: rgb(var(--v-theme-success));
}

.schedule-toolbar__title {
  font-size: 1.25rem;
  font-weight: 500;
  margin-right: 8px;
}

.schedule-toolbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.schedule-toolbar__range {
  margin-left: 8px;
  font-weight: 500;
  white-space: nowrap;
}

.schedule-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.schedule-board {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.schedule-board__header {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  width: max-content;
  min-width: 100%;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid var(--schedule-divider);
}

.schedule-board__corner {
  position: sticky;
  left: 0;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  flex: none;
  width: var(--schedule-label-width);
  padding: 0 12px 6px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid var(--schedule-divider);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.schedule-board__scale {
  flex: none;
  /* clip, not hidden: hidden would make this a scroll container and break the sticky labels. */
  overflow: clip;
}

.schedule-board__months,
.schedule-board__days {
  position: relative;
  height: 24px;
}

.schedule-board__month {
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: hidden;
  padding: 4px 6px 0;
  border-left: 1px solid var(--schedule-divider);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.schedule-board__month span {
  position: sticky;
  left: calc(var(--schedule-label-width) + 6px);
}

.schedule-board__day {
  position: absolute;
  top: 0;
  bottom: 0;
  padding-top: 3px;
  font-size: 0.72rem;
  text-align: center;
  white-space: nowrap;
  opacity: 0.8;
}

.schedule-board__day--weekend {
  opacity: 0.5;
}

.schedule-board__day--today {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  opacity: 1;
}

.schedule-board__body {
  display: flex;
  width: max-content;
  min-width: 100%;
}

.schedule-board__labels {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  width: var(--schedule-label-width);
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid var(--schedule-divider);
}

.schedule-board__label {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--schedule-divider);
  overflow: hidden;
}

/* Wall display: machine status as a wide strip down the left edge, in the status tiles' colours. */
.schedule-view--display .schedule-board__label {
  position: relative;
  padding-left: 28px;
}

.schedule-view--display .schedule-board__label::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 16px;
  background: var(--status-edge, rgba(var(--v-theme-on-surface), 0.12));
}

.schedule-view--display .schedule-board__label--status-green {
  --status-edge: #287428;
}

.schedule-view--display .schedule-board__label--status-yellow {
  --status-edge: #e89a23;
}

.schedule-view--display .schedule-board__label--status-red,
.schedule-view--display .schedule-board__label--status-red-flash {
  --status-edge: #bd0000;
}

.schedule-view--display .schedule-board__label--status-red-flash.schedule-board__label--flash-off,
.schedule-view--display .schedule-board__label--status-idle {
  --status-edge: #6c6c6c;
}

/* Offline: the idle grey hatched with the offline tile colour. */
.schedule-view--display .schedule-board__label--status-offline {
  --status-edge: repeating-linear-gradient(-45deg, #6c6c6c 0 4px, #282828 4px 8px);
}

/* Keep long names clear of the mismatch icon in the corner. */
.schedule-board__label--mismatch {
  padding-right: 26px;
}

.schedule-board__label--blocked {
  opacity: 0.35;
}

/* A machine the op being dragged doesn't fit: greyed out, and it won't take the drop. */
.schedule-board__row-blocked {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 2;
  background: repeating-linear-gradient(
    -45deg,
    rgba(var(--v-theme-on-surface), 0.1) 0 6px,
    rgba(var(--v-theme-on-surface), 0.04) 6px 12px
  );
  pointer-events: none;
}

.schedule-board__mismatch {
  position: absolute;
  top: 3px;
  right: 4px;
}

.schedule-board__machine {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-board__department {
  overflow: hidden;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.6;
}

.schedule-board__timeline {
  position: relative;
  flex: none;
  overflow: clip;
  background-image: linear-gradient(
    to bottom,
    transparent calc(var(--row-height) - 1px),
    var(--schedule-divider) calc(var(--row-height) - 1px)
  );
  background-size: 100% var(--row-height);
  /* Vuetify's reset sets no-repeat on everything; these gradients draw one row/day and repeat. */
  background-repeat: repeat;
}

.schedule-board__timeline--day-lines {
  background-image:
    linear-gradient(
      to bottom,
      transparent calc(var(--row-height) - 1px),
      var(--schedule-divider) calc(var(--row-height) - 1px)
    ),
    linear-gradient(
      to right,
      transparent calc(var(--day-width) - 1px),
      rgba(var(--v-border-color), 0.06) calc(var(--day-width) - 1px)
    );
  background-size:
    100% var(--row-height),
    var(--day-width) 100%;
}

.schedule-board__column {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
}

.schedule-board__column--weekend {
  background: rgba(var(--v-theme-on-surface), 0.045);
}

.schedule-board__column--today {
  background: rgba(var(--v-theme-primary), 0.12);
}

.schedule-board__department-line {
  position: absolute;
  right: 0;
  left: 0;
  height: 2px;
  background: rgba(var(--v-theme-on-surface), 0.28);
  pointer-events: none;
}

.schedule-board__label--department-start {
  box-shadow: inset 0 2px 0 rgba(var(--v-theme-on-surface), 0.28);
}

.schedule-board__week-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--schedule-divider);
  pointer-events: none;
}

.schedule-board__due-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 0;
  border-left: 2px dashed rgb(var(--v-theme-error));
  pointer-events: none;
}

.schedule-board__due-marker span {
  position: sticky;
  top: 0;
  display: inline-block;
  padding: 0 4px;
  border-radius: 0 0 4px 0;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  font-size: 0.68rem;
  font-weight: 700;
}

.schedule-board__tile {
  position: absolute;
  z-index: 1;
  transition:
    left 120ms ease,
    top 120ms ease,
    width 120ms ease;
}

.schedule-board__tile--active {
  z-index: 3;
  transition: none;
}

.schedule-board__empty {
  padding: 32px;
  text-align: center;
  opacity: 0.7;
}

.schedule-backlog {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 300px;
  min-height: 0;
  border-left: 1px solid var(--schedule-divider);
  background: rgb(var(--v-theme-surface));
}

.schedule-backlog__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-bottom: 1px solid var(--schedule-divider);
}

.schedule-backlog__filters {
  padding: 0;
}

.schedule-backlog__filter-count {
  margin-left: 6px;
  font-weight: 700;
  opacity: 0.7;
}

.schedule-backlog__hidden {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 4px;
  border: 1px dashed var(--schedule-divider);
  border-radius: 6px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
}

.schedule-backlog__hidden:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.schedule-backlog__hidden-action {
  margin-left: auto;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.schedule-backlog__list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}

.schedule-backlog__card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--schedule-divider);
  border-left: 6px solid var(--customer-color);
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  font-size: 0.85rem;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.schedule-backlog__card--dragging {
  opacity: 0.45;
}

.schedule-backlog__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.schedule-backlog__op {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 0.8rem;
  white-space: nowrap;
}

.schedule-backlog__customer,
.schedule-backlog__part {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-backlog__empty {
  padding: 24px 8px;
  text-align: center;
  opacity: 0.7;
}

.schedule-drag-ghost {
  position: fixed;
  z-index: 3000;
  width: 150px;
  height: 44px;
  transform: translate(-20px, -22px);
  pointer-events: none;
}

@media (max-width: 700px) {
  .schedule-view {
    --schedule-label-width: 104px;
  }

  .schedule-backlog {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    width: min(300px, 85vw);
    box-shadow: -8px 0 24px rgb(0 0 0 / 25%);
  }

  .schedule-main {
    position: relative;
  }
}
</style>

<style>
/* While a schedule drag is in progress, keep the page from selecting text under the pointer. */
body.schedule-dragging {
  cursor: grabbing;
  user-select: none;
  -webkit-user-select: none;
}

body.schedule-dragging .schedule-tile,
body.schedule-dragging .schedule-backlog__card {
  cursor: grabbing;
}
</style>
