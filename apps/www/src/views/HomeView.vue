<template>
  <div class="home-view">
    <img alt="BK Machine logo" class="home-view__logo" :src="logo" />

    <div class="scan-stage-shell">
      <div
        :aria-label="isAppScanReady ? 'Ready to scan' : 'Not ready to scan'"
        class="scan-stage"
        :class="isAppScanReady ? 'scan-stage--ready' : 'scan-stage--not-ready'"
      >
        <span class="scan-stage__corner scan-stage__corner--top-left" />
        <span class="scan-stage__corner scan-stage__corner--top-right" />
        <span class="scan-stage__corner scan-stage__corner--bottom-left" />
        <span class="scan-stage__corner scan-stage__corner--bottom-right" />

        <div
          class="scan-stage__content"
          :class="{ 'scan-stage__content--idle-collapsed': !idlePanelOpen }"
        >
          <section class="machine-section machine-section--active">
            <div class="machine-section__header">
              <div>
                <h2 class="machine-section__title">Machines In Process</h2>
              </div>
              <div class="machine-section__header-actions">
                <v-menu :close-on-content-click="false" location="bottom end">
                  <template #activator="{ props: activatorProps }">
                    <v-badge
                      :class="[
                        'machine-section__department-filter',
                        {
                          'machine-section__department-filter--active': hasDepartmentFilter,
                        },
                      ]"
                      color="primary"
                      dot
                      location="top end"
                      :model-value="hasDepartmentFilter"
                      offset-x="-3"
                      offset-y="1"
                      size="xs-small"
                    >
                      <v-icon
                        v-bind="activatorProps"
                        aria-label="Filter departments"
                        color="grey-darken-2"
                        icon="mdi-domain-switch"
                        size="24"
                      />
                    </v-badge>
                  </template>

                  <v-list density="compact" min-width="260">
                    <v-list-subheader>Included Departments</v-list-subheader>
                    <v-list-item v-if="departmentOptions.length" density="compact">
                      <template #prepend>
                        <v-checkbox-btn
                          :indeterminate="hasDepartmentFilter"
                          :model-value="areAllDepartmentsIncluded"
                          @update:model-value="toggleAllDepartments($event)"
                        />
                      </template>
                      <v-list-item-title>All Departments</v-list-item-title>
                    </v-list-item>
                    <v-list-item
                      v-for="department in departmentOptions"
                      :key="department"
                      density="compact"
                    >
                      <template #prepend>
                        <v-checkbox-btn
                          :model-value="includedDepartmentKeys.includes(department)"
                          @update:model-value="toggleDepartment(department, $event)"
                        />
                      </template>
                      <v-list-item-title>{{ department }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="!departmentOptions.length" density="compact">
                      <v-list-item-title>No departments available</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
                <v-select
                  v-model="machineSortMode"
                  base-color="grey-darken-3"
                  class="machine-section__sort"
                  color="grey-darken-3"
                  density="compact"
                  hide-details
                  item-title="label"
                  item-value="value"
                  :items="MACHINE_SORT_OPTIONS"
                  label="Sort by"
                  variant="outlined"
                />
                <v-chip color="success" size="small" variant="flat">
                  {{ runningSummaryText }}
                </v-chip>
                <button
                  v-if="!idlePanelOpen"
                  :aria-expanded="idlePanelOpen"
                  :aria-label="'Show not in progress panel'"
                  class="idle-machine-strip__toggle idle-machine-strip__toggle--header"
                  type="button"
                  @click="idlePanelOpen = true"
                >
                  &lt;
                </button>
              </div>
            </div>

            <div v-if="loading" class="machine-cards__state">Loading machines...</div>
            <div v-else-if="!activeMachines.length" class="machine-cards__state">
              No machines currently have in-process jobs.
            </div>
            <div v-else class="machine-cards-grid">
              <template v-for="item in activeMachineItems" :key="activeMachineItemKey(item)">
                <div
                  v-if="item.type === 'divider'"
                  :class="[
                    'machine-cards-divider',
                    item.variant === 'rush'
                      ? 'machine-cards-divider--rush'
                      : 'machine-cards-divider--normal',
                  ]"
                >
                  <span class="machine-cards-divider__label">{{ item.label }}</span>
                </div>

                <article
                  v-else
                  :class="[
                    'machine-card',
                    machineCardDueDateClass(item.machine.dueDate),
                    { 'machine-card--incomplete': item.machine.partHasIncompleteData },
                  ]"
                >
                  <div class="machine-card__header">
                    <div>
                      <h3 class="machine-card__title">
                        <span>{{ item.machine.machineName }}</span>
                      </h3>
                    </div>
                    <RouterLink
                      v-if="item.machine.jobId"
                      class="machine-card__job-link"
                      :to="{ name: 'viewJob', params: { id: item.machine.jobId } }"
                    >
                      Job #{{ item.machine.jobNumber ?? '—' }}
                    </RouterLink>
                    <p v-else class="machine-card__subtitle">
                      Job {{ item.machine.jobNumber ?? '—' }}
                    </p>
                  </div>

                  <div class="machine-card__body">
                    <div v-if="item.machine.partImage" class="machine-card__image-wrap">
                      <v-img class="machine-card__image" contain :src="item.machine.partImage" />
                    </div>

                    <div class="machine-card__body-main">
                      <div class="machine-card__meta-row">
                        <div class="machine-card__meta-block">
                          <span class="machine-card__meta-label">Qty</span>
                          <span class="machine-card__meta-value"
                            >{{ item.machine.qty ?? '—' }}</span
                          >
                        </div>
                        <div class="machine-card__meta-block machine-card__meta-block--due">
                          <span class="machine-card__meta-label">Due</span>
                          <v-chip
                            v-if="item.machine.dueDate"
                            :color="dueDateColor(item.machine.dueDate)"
                            size="small"
                            variant="tonal"
                          >
                            {{ formatRelativeDate(item.machine.dueDate) }}
                          </v-chip>
                          <span
                            v-else
                            class="machine-card__meta-value machine-card__meta-value--empty"
                          >
                            —
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="machine-card__content">
                    <!-- <span class="machine-card__content-label">Part / Description</span> -->
                    <v-tooltip
                      :disabled="!displayMachinePartText(item.machine)"
                      location="top"
                      open-delay="1500"
                    >
                      <template #activator="{ props }">
                        <span v-bind="props" class="machine-card__content-value">
                          <RouterLink
                            v-if="item.machine.partId && displayMachinePartNumber(item.machine)"
                            class="machine-card__part-link"
                            :to="{ name: 'viewPart', params: { id: item.machine.partId } }"
                          >
                            {{ displayMachinePartNumber(item.machine) }}
                          </RouterLink>
                          <span v-else>{{ displayMachinePartNumber(item.machine) || '—' }}</span>
                          <span v-if="displayMachinePartDescription(item.machine)">
                            / {{ displayMachinePartDescription(item.machine) }}
                          </span>
                        </span>
                      </template>

                      <span style="white-space: nowrap"
                        >{{ displayMachinePartText(item.machine) }}</span
                      >
                    </v-tooltip>
                  </div>
                </article>
              </template>
            </div>
          </section>

          <aside
            class="idle-machine-strip"
            :class="{ 'idle-machine-strip--collapsed': !idlePanelOpen }"
          >
            <button
              v-if="idlePanelOpen"
              :aria-expanded="idlePanelOpen"
              :aria-label="'Hide not in progress panel'"
              class="idle-machine-strip__toggle"
              type="button"
              @click="idlePanelOpen = false"
            >
              &gt;
            </button>
            <div v-if="idlePanelOpen" class="idle-machine-strip__header">
              <h3 class="idle-machine-strip__title">Not In Process</h3>
              <v-chip v-if="idleMachines.length" color="grey-darken-1" size="small" variant="flat">
                {{ idleMachines.length }}
                idle
              </v-chip>
            </div>

            <div v-if="idlePanelOpen" class="idle-machine-strip__body">
              <div v-if="loading" class="idle-machine-strip__state">Loading machines...</div>
              <div v-else-if="!idleMachines.length" class="idle-machine-strip__state">
                <v-chip color="success" size="small" variant="flat">All machines active</v-chip>
              </div>
              <div v-else class="idle-machine-strip__chips">
                <v-chip
                  v-for="machine in idleMachines"
                  :key="machine.machineId"
                  class="idle-machine-strip__chip"
                  color="grey-lighten-1"
                  size="small"
                  variant="flat"
                >
                  {{ machine.machineName }}
                </v-chip>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <v-checkbox
        v-model="idleHomeRedirectEnabled"
        class="scan-stage-shell__checkbox scan-stage-shell__checkbox--idle"
        color="primary"
        hide-details
        label="Idle Timer"
      />

      <div v-if="loadFailed" class="scan-stage-shell__error">Unable to load machine dashboard.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import logo from '@/assets/img/bk_logo.png';
import { dueDateColor, formatRelativeDate } from '@/lib/job_dates';
import { fetchMachineDepartmentOptions } from '@/lib/machineDepartments';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { toastError } from '@/plugins/vue-toast-notification';
import { isAppScanReady, useIdleHomeRedirectEnabled } from '@/state/app_focus';

const MACHINE_SORT_STORAGE_KEY = 'home-machine-sort-mode';
const IDLE_PANEL_OPEN_STORAGE_KEY = 'home-idle-panel-open';
const INCLUDED_DEPARTMENTS_STORAGE_KEY = 'home-included-departments';
const MACHINE_SORT_OPTIONS = [
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Name', value: 'machineName' },
] as const;

type MachineSortMode = (typeof MACHINE_SORT_OPTIONS)[number]['value'];
type ActiveMachineListItem =
  | { type: 'machine'; machine: MachineJobDashboardRow }
  | {
      type: 'divider';
      key: 'rush-priority-divider' | 'normal-priority-divider';
      label: 'Rush Jobs' | 'Normal Jobs';
      variant: 'rush' | 'normal';
    };

const idleHomeRedirectEnabled = useIdleHomeRedirectEnabled;
const loading = ref(false);
const loadFailed = ref(false);
const hasLoadedDashboard = ref(false);
const idlePanelOpen = ref(readIdlePanelOpen());
const dashboard = ref<MachineJobDashboardResponse>({ active: [], idle: [] });
const machineSortMode = ref<MachineSortMode>(readMachineSortMode());
const includedDepartmentKeys = ref<string[]>(readIncludedDepartments());
const departmentOptions = ref<string[]>([]);
const departmentOptionsLoaded = ref(false);
const hasDepartmentFilter = computed(() => {
  return (
    departmentOptions.value.length > 0 &&
    includedDepartmentKeys.value.length !== departmentOptions.value.length
  );
});
const areAllDepartmentsIncluded = computed(() => {
  return (
    departmentOptions.value.length > 0 &&
    includedDepartmentKeys.value.length === departmentOptions.value.length
  );
});
const filteredDashboard = computed<MachineJobDashboardResponse>(() => {
  const includedDepartments = new Set(includedDepartmentKeys.value);
  const shouldFilter = departmentOptions.value.length > 0;
  const matchesDepartment = (machine: MachineJobDashboardRow) => {
    if (!shouldFilter) return true;

    const department = machine.department?.trim() || '';
    if (department && !departmentOptions.value.includes(department)) return true;
    if (!department) return includedDepartments.size === 0;
    return includedDepartments.has(department);
  };

  return {
    active: dashboard.value.active.filter(matchesDepartment),
    idle: dashboard.value.idle.filter(matchesDepartment),
  };
});

const activeMachines = computed(() =>
  [...filteredDashboard.value.active].sort(compareActiveMachines),
);
const rushActiveMachines = computed(() =>
  activeMachines.value.filter((machine) => machine.priority === 'rush'),
);
const normalActiveMachines = computed(() =>
  activeMachines.value.filter((machine) => machine.priority !== 'rush'),
);
const activeMachineItems = computed<ActiveMachineListItem[]>(() => {
  const rushItems = rushActiveMachines.value.map((machine) => ({
    type: 'machine' as const,
    machine,
  }));
  const normalItems = normalActiveMachines.value.map((machine) => ({
    type: 'machine' as const,
    machine,
  }));

  if (!rushItems.length || !normalItems.length) {
    if (!rushItems.length) return normalItems;

    return [
      {
        type: 'divider',
        key: 'rush-priority-divider',
        label: 'Rush Jobs',
        variant: 'rush',
      },
      ...rushItems,
    ];
  }

  return [
    {
      type: 'divider',
      key: 'rush-priority-divider',
      label: 'Rush Jobs',
      variant: 'rush',
    },
    ...rushItems,
    {
      type: 'divider',
      key: 'normal-priority-divider',
      label: 'Normal Jobs',
      variant: 'normal',
    },
    ...normalItems,
  ];
});
const idleMachines = computed(() => filteredDashboard.value.idle);
const activeMachineCount = computed(() => {
  return new Set(activeMachines.value.map((machine) => machine.machineId)).size;
});
const totalMachineCount = computed(() => activeMachineCount.value + idleMachines.value.length);
const runningSummaryText = computed(() => {
  if (idlePanelOpen.value) return `${activeMachines.value.length} tasks in process`;
  return `${activeMachines.value.length} tasks on ${activeMachineCount.value} machines`;
});

function activeMachineCardKey(machine: MachineJobDashboardRow) {
  return machine.taskId || machine.jobId || `${machine.machineId}-${machine.jobNumber ?? 'none'}`;
}

function activeMachineItemKey(item: ActiveMachineListItem) {
  return item.type === 'divider' ? item.key : activeMachineCardKey(item.machine);
}

function readMachineSortMode(): MachineSortMode {
  if (typeof window === 'undefined') return 'dueDate';

  const storedValue = window.localStorage.getItem(MACHINE_SORT_STORAGE_KEY);
  return storedValue === 'machineName' ? 'machineName' : 'dueDate';
}

function readIdlePanelOpen(): boolean {
  if (typeof window === 'undefined') return false;

  return window.localStorage.getItem(IDLE_PANEL_OPEN_STORAGE_KEY) === 'true';
}

function readIncludedDepartments(): string[] {
  if (typeof window === 'undefined') return [];

  const storedValue = window.localStorage.getItem(INCLUDED_DEPARTMENTS_STORAGE_KEY);
  if (!storedValue) return [];

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function toggleDepartment(department: string, included: boolean | null) {
  if (included) {
    includedDepartmentKeys.value = [...new Set([...includedDepartmentKeys.value, department])].sort(
      (left, right) => left.localeCompare(right),
    );
    return;
  }

  includedDepartmentKeys.value = includedDepartmentKeys.value.filter(
    (value) => value !== department,
  );
}

function toggleAllDepartments(included: boolean | null) {
  includedDepartmentKeys.value = included ? [...departmentOptions.value] : [];
}

function compareMachineDueDate(left: MachineJobDashboardRow, right: MachineJobDashboardRow) {
  const leftTime = normalizeMachineDueDate(left.dueDate);
  const rightTime = normalizeMachineDueDate(right.dueDate);
  if (leftTime !== rightTime) return leftTime - rightTime;

  const leftJobNumber = left.jobNumber ?? Number.MAX_SAFE_INTEGER;
  const rightJobNumber = right.jobNumber ?? Number.MAX_SAFE_INTEGER;
  if (leftJobNumber !== rightJobNumber) return leftJobNumber - rightJobNumber;

  return left.machineName.localeCompare(right.machineName);
}

function compareActiveMachines(left: MachineJobDashboardRow, right: MachineJobDashboardRow) {
  const priorityOrder = compareMachinePriority(left, right);
  if (priorityOrder !== 0) return priorityOrder;

  if (machineSortMode.value === 'machineName') {
    const nameOrder = left.machineName.localeCompare(right.machineName);
    if (nameOrder !== 0) return nameOrder;

    return compareMachineDueDate(left, right);
  }

  return compareMachineDueDate(left, right);
}

function compareMachinePriority(left: MachineJobDashboardRow, right: MachineJobDashboardRow) {
  const leftRank = left.priority === 'rush' ? 0 : 1;
  const rightRank = right.priority === 'rush' ? 0 : 1;
  return leftRank - rightRank;
}

function normalizeMachineDueDate(value: string | Date | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function machineCardDueDateClass(value: string | Date | null | undefined) {
  const color = dueDateColor(value);

  if (color === 'error') return 'machine-card--due-error';
  if (color === 'warning') return 'machine-card--due-warning';
  if (color === 'success') return 'machine-card--due-success';
  if (color === 'purple-lighten-2') return 'machine-card--due-future';
  return 'machine-card--due-default';
}

function displayMachinePartNumber(machine: MachineJobDashboardRow) {
  return machine.partNumber?.trim() || '';
}

function displayMachinePartDescription(machine: MachineJobDashboardRow) {
  return machine.partDescription?.trim() || '';
}

function displayMachinePartText(machine: MachineJobDashboardRow) {
  const partNumber = displayMachinePartNumber(machine);
  const partDescription = displayMachinePartDescription(machine);

  if (partNumber && partDescription) return `${partNumber} / ${partDescription}`;
  return partNumber || partDescription;
}

async function fetchMachineDashboard() {
  const isInitialLoad = !hasLoadedDashboard.value;
  if (isInitialLoad) {
    loading.value = true;
  }
  loadFailed.value = false;

  try {
    const { data } = await api.get<MachineJobDashboardResponse>('/jobs/machine-dashboard');
    dashboard.value = data;
    hasLoadedDashboard.value = true;
  } catch (error) {
    dashboard.value = { active: [], idle: [] };
    loadFailed.value = true;
    toastError('Unable to load machine dashboard.');
    throw error;
  } finally {
    if (isInitialLoad) {
      loading.value = false;
    }
  }
}

async function fetchDepartmentOptions() {
  try {
    departmentOptions.value = await fetchMachineDepartmentOptions();
  } catch (error) {
    departmentOptions.value = [];
    console.warn('Unable to load machine department options.', error);
  } finally {
    departmentOptionsLoaded.value = true;
  }
}

function syncIncludedDepartments(options: string[]) {
  if (!departmentOptionsLoaded.value) return;

  if (!options.length) {
    includedDepartmentKeys.value = [];
    return;
  }

  const nextIncluded = includedDepartmentKeys.value.filter((department) =>
    options.includes(department),
  );
  includedDepartmentKeys.value = nextIncluded.length ? nextIncluded : [...options];
}

function refreshMachineDashboard() {
  void fetchMachineDashboard();
}

onMounted(() => {
  void fetchMachineDashboard();
  void fetchDepartmentOptions();
  socket.on('job', refreshMachineDashboard);
  socket.on('jobDeleted', refreshMachineDashboard);
  socket.on('part', refreshMachineDashboard);
});

onBeforeUnmount(() => {
  socket.off('job', refreshMachineDashboard);
  socket.off('jobDeleted', refreshMachineDashboard);
  socket.off('part', refreshMachineDashboard);
});

if (typeof window !== 'undefined') {
  machineSortMode.value = readMachineSortMode();
}

watch(machineSortMode, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MACHINE_SORT_STORAGE_KEY, value);
});

watch(idlePanelOpen, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(IDLE_PANEL_OPEN_STORAGE_KEY, String(value));
});

watch(
  departmentOptions,
  (options) => {
    syncIncludedDepartments(options);
  },
  { immediate: true },
);

watch(departmentOptionsLoaded, (loaded) => {
  if (!loaded) return;
  syncIncludedDepartments(departmentOptions.value);
});

watch(includedDepartmentKeys, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INCLUDED_DEPARTMENTS_STORAGE_KEY, JSON.stringify(value));
});
</script>

<style scoped>
.home-view {
  position: relative;
  min-height: calc(100dvh - 64px);
  overflow: hidden;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.94) 0%,
    rgba(248, 245, 238, 0.98) 62%,
    rgba(240, 236, 228, 1) 100%
  );
}

.home-view__logo {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(52vw, 640px);
  transform: translate(-50%, -50%);
  opacity: 0.08;
  filter: grayscale(1);
  pointer-events: none;
  user-select: none;
}

.scan-stage-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: calc(100dvh - 64px);
  padding: 14px;
}

.scan-stage {
  position: relative;
  width: 100%;
  min-height: calc(100dvh - 92px);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
  overflow: hidden;
}

.scan-stage-shell__checkbox {
  position: absolute;
  top: 24px;
  right: 28px;
  z-index: 3;
  /* background: rgba(255, 255, 255, 0.74); */
  padding: 2px 10px;
  border-radius: 999px;
  /* backdrop-filter: blur(4px); */
}

.scan-stage-shell__checkbox--idle {
  top: auto;
  bottom: 22px;
}

.scan-stage-shell__error {
  position: absolute;
  right: 28px;
  bottom: 60px;
  z-index: 3;
  color: rgb(146, 0, 0);
  background: rgba(255, 255, 255, 0.78);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.85rem;
}

.scan-stage__content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  min-height: calc(100dvh - 92px);
  transition: grid-template-columns 180ms ease;
}

.scan-stage__content--idle-collapsed {
  grid-template-columns: minmax(0, 1fr) 0;
}

.machine-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px 20px 22px;
}

.machine-section--active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0.18));
}

.machine-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.machine-section__header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.machine-section__sort {
  width: 156px;
  color: rgba(50, 42, 34, 0.88);
}

.machine-section__department-filter {
  margin-right: 0;
  transition: margin-right 180ms ease;
}

.machine-section__department-filter--active {
  margin-right: 4px;
}

.machine-section__eyebrow {
  margin: 0 0 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(79, 64, 49, 0.66);
}

.machine-section__title {
  margin: 0;
  font-size: clamp(1.05rem, 1.2vw, 1.45rem);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: rgba(27, 21, 15, 0.9);
}

.machine-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
  gap: 10px;
  align-content: flex-start;
}

.machine-cards-divider {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0;
  color: rgba(88, 77, 65, 0.76);
}

.machine-cards-divider--rush {
  color: rgba(183, 28, 28, 0.92);
}

.machine-cards-divider--normal {
  color: rgba(88, 77, 65, 0.76);
}

.machine-cards-divider::before,
.machine-cards-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(88, 77, 65, 0.12), rgba(88, 77, 65, 0.3));
}

.machine-cards-divider--rush::before,
.machine-cards-divider--rush::after {
  background: linear-gradient(90deg, rgba(198, 40, 40, 0.2), rgba(198, 40, 40, 0.72));
}

.machine-cards-divider__label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

@media (min-width: 1800px) {
  .machine-cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}

.machine-cards__state {
  color: rgba(58, 53, 48, 0.72);
  font-size: 0.95rem;
}

.machine-card {
  --machine-card-accent: rgba(117, 117, 117, 0.85);
  --machine-card-border: var(--machine-card-accent);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 5px 12px;
  border: 2px solid var(--machine-card-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.04);
}

.machine-card--due-default {
  --machine-card-accent: rgba(117, 117, 117, 0.85);
}

.machine-card--due-error {
  --machine-card-accent: rgba(198, 40, 40, 0.95);
}

.machine-card--due-warning {
  --machine-card-accent: rgba(251, 140, 0, 0.95);
}

.machine-card--due-success {
  --machine-card-accent: rgba(67, 160, 71, 0.95);
}

.machine-card--due-future {
  --machine-card-accent: rgba(186, 104, 200, 0.95);
}

.machine-card--incomplete {
  --machine-card-border: rgba(156, 163, 175, 0.95);
  border-style: dashed;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--machine-card-accent) 50%, transparent),
    0 10px 22px rgba(0, 0, 0, 0.04);
}

.machine-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.machine-card__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgba(27, 21, 15, 0.92);
}

.machine-card__job-link,
.machine-card__subtitle {
  margin: 2px 0 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: rgba(88, 77, 65, 0.72);
  text-decoration: none;
}

.machine-card__job-link {
  color: rgb(var(--v-theme-primary));
}

.machine-card__body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.machine-card__image-wrap {
  position: relative;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(50, 42, 34, 0.08);
  cursor: zoom-in;
  transition:
    transform 140ms ease,
    box-shadow 140ms ease,
    border-color 140ms ease;
  transform-origin: top left;
}

.machine-card__image {
  width: 100%;
  height: 100%;
}

.machine-card__image-wrap:hover {
  z-index: 2;
  transform: scale(4.25);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.2);
  border-color: rgba(50, 42, 34, 0.18);
}

.machine-card__body-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 1px;
}

.machine-card__meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 16px;
}

.machine-card__meta-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.machine-card__meta-block--due {
  margin-left: auto;
  align-items: flex-end;
}

.machine-card__meta-label,
.machine-card__content-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(88, 77, 65, 0.64);
}

.machine-card__meta-value {
  font-size: 0.92rem;
  font-weight: 700;
  color: rgba(27, 21, 15, 0.92);
}

.machine-card__meta-value--empty {
  font-size: 0.8rem;
  color: rgba(65, 59, 52, 0.58);
}

.machine-card__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.machine-card__content-value {
  font-size: 0.88rem;
  line-height: 1.2;
  color: rgba(27, 21, 15, 0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.machine-card__part-link {
  color: inherit;
  text-decoration: none;
}

.machine-card__part-link:hover {
  text-decoration: underline;
}

.idle-machine-strip {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 20px 24px 22px 18px;
  overflow: hidden;
  transition:
    padding 180ms ease,
    background-color 180ms ease;
}

.idle-machine-strip--collapsed {
  gap: 0;
  padding: 0;
}

.idle-machine-strip::before {
  content: "";
  position: absolute;
  top: 24px;
  bottom: 24px;
  right: 240px;
  width: 1px;
  background: linear-gradient(180deg, rgba(50, 42, 34, 0.04), rgba(50, 42, 34, 0.14));
}

.idle-machine-strip__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(125, 135, 145, 0.18);
  color: rgba(44, 37, 31, 0.82);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    transform 180ms ease;
}

.idle-machine-strip__toggle:hover {
  background: rgba(125, 135, 145, 0.28);
}

.idle-machine-strip__toggle--header {
  flex: 0 0 auto;
}

.idle-machine-strip__toggle:focus-visible {
  outline: 2px solid rgba(33, 150, 243, 0.65);
  outline-offset: 2px;
}

.idle-machine-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.idle-machine-strip--collapsed .idle-machine-strip__header {
  align-items: center;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
}

.idle-machine-strip__title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(79, 64, 49, 0.7);
}

.idle-machine-strip--collapsed .idle-machine-strip__title {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
}

.idle-machine-strip__body {
  min-height: 0;
}

.idle-machine-strip__chips {
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  gap: 10px;
  align-items: flex-start;
  align-content: flex-start;
  overflow-y: auto;
  padding-right: 8px;
}

.idle-machine-strip__chip {
  align-self: flex-start;
  justify-content: flex-start;
  color: rgba(46, 42, 38, 0.92);
  background: rgba(191, 196, 201, 0.9);
  font-weight: 600;
  font-size: 0.76rem;
  min-height: 28px;
  letter-spacing: 0.01em;
}

.idle-machine-strip__state {
  display: flex;
  align-items: center;
  color: rgba(58, 53, 48, 0.72);
  font-size: 0.95rem;
}

.scan-stage__corner {
  position: absolute;
  z-index: 2;
  width: 10%;
  min-width: 64px;
  height: 10%;
  min-height: 46px;
  border-color: inherit;
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}

.scan-stage__corner--top-left {
  top: 0;
  left: 0;
  border-top-width: 3px;
  border-left-width: 3px;
  border-top-left-radius: 12px;
}

.scan-stage__corner--top-right {
  top: 0;
  right: 0;
  border-top-width: 3px;
  border-right-width: 3px;
  border-top-right-radius: 12px;
}

.scan-stage__corner--bottom-left {
  bottom: 0;
  left: 0;
  border-bottom-width: 3px;
  border-left-width: 3px;
  border-bottom-left-radius: 12px;
}

.scan-stage__corner--bottom-right {
  right: 0;
  bottom: 0;
  border-right-width: 3px;
  border-bottom-width: 3px;
  border-bottom-right-radius: 12px;
}

.scan-stage--ready {
  color: rgb(46, 160, 67);
  box-shadow:
    0 0 0 6px rgba(46, 160, 67, 0.16),
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.scan-stage--not-ready {
  color: rgb(198, 40, 40);
  box-shadow:
    0 0 0 6px rgba(198, 40, 40, 0.14),
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

@media (max-width: 900px) {
  .scan-stage-shell {
    padding: 10px;
  }

  .scan-stage {
    border-radius: 10px;
    min-height: calc(100dvh - 84px);
  }

  .scan-stage__corner--top-left {
    border-top-left-radius: 10px;
  }

  .scan-stage__corner--top-right {
    border-top-right-radius: 10px;
  }

  .scan-stage__corner--bottom-left {
    border-bottom-left-radius: 10px;
  }

  .scan-stage__corner--bottom-right {
    border-bottom-right-radius: 10px;
  }

  .scan-stage__content {
    grid-template-columns: 1fr;
    min-height: calc(100dvh - 84px);
  }

  .scan-stage__content--idle-collapsed {
    grid-template-columns: 1fr;
  }

  .machine-section {
    padding: 24px 18px 18px;
  }

  .machine-cards-grid {
    grid-template-columns: 1fr;
  }

  .machine-card__body {
    flex-direction: column;
  }

  .machine-card__image-wrap {
    width: 100%;
    max-width: 84px;
    height: 84px;
  }

  .idle-machine-strip {
    padding: 0 18px 18px;
  }

  .idle-machine-strip--collapsed {
    padding: 0;
  }

  .idle-machine-strip::before {
    display: none;
  }

  .idle-machine-strip--collapsed .idle-machine-strip__header {
    flex-direction: row;
    justify-content: space-between;
  }

  .idle-machine-strip--collapsed .idle-machine-strip__title {
    writing-mode: initial;
    transform: none;
    font-size: 0.82rem;
    letter-spacing: 0.12em;
  }

  .idle-machine-strip__chips {
    flex-direction: row;
    flex-wrap: wrap;
    padding-right: 0;
  }

  .machine-section__header {
    align-items: stretch;
    flex-direction: column;
  }

  .scan-stage-shell__checkbox {
    top: 18px;
    right: 18px;
  }

  .scan-stage-shell__checkbox--preview {
    top: auto;
    bottom: 18px;
  }

  .scan-stage__corner {
    min-width: 44px;
    min-height: 34px;
  }

  .scan-stage__corner--top-left,
  .scan-stage__corner--top-right {
    border-top-width: 2px;
  }

  .scan-stage__corner--bottom-left,
  .scan-stage__corner--bottom-right {
    border-bottom-width: 2px;
  }

  .scan-stage__corner--top-left,
  .scan-stage__corner--bottom-left {
    border-left-width: 2px;
  }

  .scan-stage__corner--top-right,
  .scan-stage__corner--bottom-right {
    border-right-width: 2px;
  }

  .home-view__logo {
    width: min(76vw, 520px);
  }
}
</style>
