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

        <div class="scan-stage__content">
          <section class="machine-section machine-section--active">
            <div class="machine-section__header">
              <div>
                <h2 class="machine-section__title">Machines In Process</h2>
              </div>
              <div class="machine-section__header-actions">
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
                  {{ activeMachines.length }}
                  running
                </v-chip>
              </div>
            </div>

            <div v-if="loading" class="machine-cards__state">Loading machines...</div>
            <div v-else-if="!activeMachines.length" class="machine-cards__state">
              No machines currently have in-process jobs.
            </div>
            <div v-else class="machine-cards-grid">
              <article
                v-for="machine in activeMachines"
                :key="machine.machineId"
                class="machine-card"
                :style="{ '--machine-card-border': machineCardBorderColor(machine.dueDate) }"
              >
                <div class="machine-card__header">
                  <div>
                    <h3 class="machine-card__title">{{ machine.machineName }}</h3>
                  </div>
                  <RouterLink
                    v-if="machine.jobId"
                    class="machine-card__job-link"
                    :to="{ name: 'viewJob', params: { id: machine.jobId } }"
                  >
                    Job #{{ machine.jobNumber ?? '—' }}
                  </RouterLink>
                  <p v-else class="machine-card__subtitle">Job {{ machine.jobNumber ?? '—' }}</p>
                </div>

                <div class="machine-card__body">
                  <div v-if="machine.partImage" class="machine-card__image-wrap">
                    <v-img class="machine-card__image" contain :src="machine.partImage" />
                  </div>

                  <div class="machine-card__body-main">
                    <div class="machine-card__meta-row">
                      <div class="machine-card__meta-block">
                        <span class="machine-card__meta-label">Qty</span>
                        <span class="machine-card__meta-value">{{ machine.qty ?? '—' }}</span>
                      </div>
                      <div class="machine-card__meta-block machine-card__meta-block--due">
                        <span class="machine-card__meta-label">Due</span>
                        <v-chip
                          v-if="machine.dueDate"
                          :color="dueDateColor(machine.dueDate)"
                          size="small"
                          variant="tonal"
                        >
                          {{ formatRelativeDate(machine.dueDate) }}
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
                  <span class="machine-card__content-value">{{ machine.partSummary || '—' }}</span>
                </div>
              </article>
            </div>
          </section>

          <aside class="idle-machine-strip">
            <div class="idle-machine-strip__header">
              <h3 class="idle-machine-strip__title">Not In Process</h3>
              <v-chip v-if="idleMachines.length" color="grey-darken-1" size="small" variant="flat">
                {{ idleMachines.length }}
                idle
              </v-chip>
            </div>

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
import { computed, onMounted, ref, watch } from 'vue';
import logo from '@/assets/img/bk_logo.png';
import { dueDateColor, formatRelativeDate } from '@/lib/job_dates';
import api from '@/plugins/axios';
import { toastError } from '@/plugins/vue-toast-notification';
import { isAppScanReady, useIdleHomeRedirectEnabled } from '@/state/app_focus';

const MACHINE_SORT_STORAGE_KEY = 'home-machine-sort-mode';
const MACHINE_SORT_OPTIONS = [
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Name', value: 'machineName' },
] as const;

type MachineSortMode = (typeof MACHINE_SORT_OPTIONS)[number]['value'];

const idleHomeRedirectEnabled = useIdleHomeRedirectEnabled;
const loading = ref(false);
const loadFailed = ref(false);
const dashboard = ref<MachineJobDashboardResponse>({ active: [], idle: [] });
const machineSortMode = ref<MachineSortMode>(readMachineSortMode());

const activeMachines = computed(() =>
  [...dashboard.value.active].sort((left, right) => {
    if (machineSortMode.value === 'machineName') {
      const nameOrder = left.machineName.localeCompare(right.machineName);
      if (nameOrder !== 0) return nameOrder;

      return compareMachineDueDate(left, right);
    }

    return compareMachineDueDate(left, right);
  }),
);
const idleMachines = computed(() => dashboard.value.idle);

function readMachineSortMode(): MachineSortMode {
  if (typeof window === 'undefined') return 'dueDate';

  const storedValue = window.localStorage.getItem(MACHINE_SORT_STORAGE_KEY);
  return storedValue === 'machineName' ? 'machineName' : 'dueDate';
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

function normalizeMachineDueDate(value: string | Date | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function machineCardBorderColor(value: string | Date | null | undefined) {
  const color = dueDateColor(value);

  if (color === 'error') return 'rgba(198, 40, 40, 0.95)';
  if (color === 'warning') return 'rgba(251, 140, 0, 0.95)';
  if (color === 'success') return 'rgba(67, 160, 71, 0.95)';
  if (color === 'purple-lighten-2') return 'rgba(186, 104, 200, 0.95)';
  return 'rgba(117, 117, 117, 0.85)';
}

async function fetchMachineDashboard() {
  loading.value = true;
  loadFailed.value = false;

  try {
    const { data } = await api.get<MachineJobDashboardResponse>('/jobs/machine-dashboard');
    dashboard.value = data;
  } catch (error) {
    dashboard.value = { active: [], idle: [] };
    loadFailed.value = true;
    toastError('Unable to load machine dashboard.');
    throw error;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void fetchMachineDashboard();
});

if (typeof window !== 'undefined') {
  machineSortMode.value = readMachineSortMode();
}

watch(machineSortMode, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MACHINE_SORT_STORAGE_KEY, value);
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
  --machine-card-border: rgba(117, 117, 117, 0.85);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 5px 12px;
  border: 2px solid var(--machine-card-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.04);
}

.machine-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.machine-card__title {
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

.idle-machine-strip {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 20px 24px 22px 18px;
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

.idle-machine-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.idle-machine-strip__title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(79, 64, 49, 0.7);
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

  .idle-machine-strip::before {
    display: none;
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
