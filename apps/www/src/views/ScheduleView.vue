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
          v-if="unscheduledJobCount"
          class="ml-2"
          color="warning"
          :content="unscheduledJobCount"
          inline
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
              ]"
              :style="{ height: `${rowHeight}px` }"
            >
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
              :entry="tile.entry"
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
          <v-switch
            v-model="hideScheduled"
            color="primary"
            density="compact"
            hide-details
            label="Unscheduled only"
          />
          <div class="text-body-small text-medium-emphasis">
            Drag a job onto a machine{{ isTouchDevice ? ' (press and hold)' : '' }}, or tap it.
          </div>
        </div>
        <div class="schedule-backlog__list">
          <div
            v-for="item in backlogItems"
            :key="item.job._id"
            :class="[
              'schedule-backlog__card',
              { 'schedule-backlog__card--dragging': drag?.kind === 'new' && drag.job._id === item.job._id },
            ]"
            :style="{ '--customer-color': colorForCustomer(item.job.customerId) }"
            @contextmenu.prevent
            @pointerdown="onBacklogPointerDown($event, item.job)"
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
          <div v-if="!backlogItems.length" class="schedule-backlog__empty">
            {{ backlogJobs.length ? 'Every open job is on the schedule.' : 'No open jobs.' }}
          </div>
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
        :entry="{ job: drag.job, start: today, days: 1 }"
        :today="today"
        :width="150"
      />
    </div>

    <ScheduleEntryDialog
      v-if="!display"
      v-model="dialogOpen"
      :entry="dialogEntry"
      :estimator="estimateFor"
      :initial="dialogInitial"
      :job="dialogJob"
      :machines="visibleMachines.length ? visibleMachines : machines"
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
  isScheduleWorkday,
  placeScheduleEntry,
  SCHEDULE_TIGHT_SLACK_DAYS,
  type ScheduleEstimate,
  scheduleEnd,
} from '@repo/utilities/schedule';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ScheduleEntryDialog from '@/components/schedule/ScheduleEntryDialog.vue';
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

type Placement = Omit<ScheduleEntryPlacement, '_id'>;

interface DragState {
  kind: 'move' | 'resize' | 'new';
  pointerId: number;
  pointerType: string;
  job: ScheduleEntryJob;
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
    const draft: ScheduleEntry = { _id: PREVIEW_ID, job: state.job, ...state.preview };
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
let backlogRefreshTimer: ReturnType<typeof setTimeout> | null = null;

watch(backlogOpen, (open) => {
  window.localStorage.setItem(BACKLOG_STORAGE_KEY, String(open));
  requestAnimationFrame(measureBoard);
});

const scheduledCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const entry of scheduleStore.entries) {
    counts.set(entry.job._id, (counts.get(entry.job._id) ?? 0) + 1);
  }
  return counts;
});

const unscheduledJobCount = computed(
  () => backlogJobs.value.filter((job) => !scheduledCounts.value.has(job._id)).length,
);

const backlogItems = computed(() => {
  const search = backlogSearch.value?.trim().toLowerCase() ?? '';
  return backlogJobs.value
    .map((job) => ({ job, scheduledCount: scheduledCounts.value.get(job._id) ?? 0 }))
    .filter(({ job, scheduledCount }) => {
      if (hideScheduled.value && scheduledCount) return false;
      if (!search) return true;
      return [String(job.jobNumber), job.customerName, job.partNumber, job.partDescription]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
});

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

/** How long `job` would run on `machineId` from `start`; null without cycle times to go on. */
function estimateFor(
  job: ScheduleEntryJob,
  machineId: string,
  start: string,
): ScheduleEstimate | null {
  return estimateScheduleLength({
    routing: routingByJob.value.get(job._id),
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

function openEntryDialog(entry: ScheduleEntry) {
  dialogEntry.value = entry;
  dialogJob.value = entry.job;
  dialogInitial.value = { machineId: entry.machineId, start: entry.start, days: entry.days };
  dialogOpen.value = true;
}

function openNewJobDialog(job: ScheduleEntryJob) {
  const machineId = visibleMachines.value[0]?.id ?? machines.value[0]?.id ?? '';
  dialogEntry.value = null;
  dialogJob.value = job;
  const start = nextOpenDay(machineId);
  const days = estimateFor(job, machineId, start)?.days ?? 1;
  dialogInitial.value = { machineId, start, days };
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
    } else if (dialogJob.value) {
      await scheduleStore.add(dialogJob.value, placement);
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

function onBacklogPointerDown(event: PointerEvent, job: ScheduleEntryJob) {
  if (drag.value || (event.pointerType === 'mouse' && event.button !== 0)) return;
  beginPointer(event, { kind: 'new', job, entryId: null, origin: null, grabOffset: 0 });
}

function beginPointer(
  event: PointerEvent,
  fields: Pick<DragState, 'kind' | 'job' | 'entryId' | 'origin' | 'grabOffset'>,
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
  } else {
    openNewJobDialog(state.job);
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
    void scheduleStore.add(state.job, preview).catch(() => undefined);
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
  const machineId = visibleMachines.value[row]?.id;
  if (!machineId) return;

  if (state.kind === 'resize' && state.origin) {
    const startOffset = diffDays(rangeStart.value, state.origin.start);
    state.preview = { ...state.origin, days: Math.max(1, day - startOffset + 1) };
    return;
  }

  if (state.kind === 'move' && state.origin) {
    state.preview = {
      machineId,
      start: addDays(rangeStart.value, day - state.grabOffset),
      days: state.origin.days,
    };
    return;
  }

  // A job from the list only lands once it is over the board; elsewhere it just follows along.
  const overTimeline = state.lastX >= rect.left && state.lastY >= rect.top;
  state.preview =
    isOverBoard(state.lastX, state.lastY) && overTimeline
      ? newBookingPlacement(state.job, machineId, addDays(rangeStart.value, day))
      : null;
}

function newBookingPlacement(job: ScheduleEntryJob, machineId: string, start: string): Placement {
  return { machineId, start, days: estimateFor(job, machineId, start)?.days ?? 1 };
}

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
}

onMounted(() => {
  void fetchMachines().then(() => requestAnimationFrame(measureBoard));
  scheduleStore.listen();
  void scheduleStore.fetchSettings().catch(() => undefined);

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
