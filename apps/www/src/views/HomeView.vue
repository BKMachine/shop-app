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
              <v-chip color="success" size="small" variant="flat">
                {{ activeMachines.length }}
                running
              </v-chip>
            </div>

            <v-data-table
              class="machine-table machine-table--active"
              density="comfortable"
              :headers="tableHeaders"
              :items="activeMachines"
              :items-per-page="-1"
              :loading="loading"
            >
              <template #item.jobNumber="{ item }">
                <span class="machine-table__job-number">{{ item.jobNumber ?? '—' }}</span>
              </template>

              <template #item.partSummary="{ item }">
                <span>{{ item.partSummary || '—' }}</span>
              </template>

              <template #item.qty="{ item }">
                <span class="machine-table__qty">{{ item.qty ?? '—' }}</span>
              </template>

              <template #item.dueDate="{ item }">
                <v-chip
                  v-if="item.dueDate"
                  :color="dueDateColor(item.dueDate)"
                  size="small"
                  variant="tonal"
                >
                  {{ formatRelativeDate(item.dueDate) }}
                </v-chip>
                <span v-else class="machine-table__empty">—</span>
              </template>

              <template #item.openJob="{ item }">
                <v-btn
                  v-if="item.jobId"
                  :aria-label="`Open job ${item.jobNumber ?? ''}`.trim()"
                  color="primary"
                  icon="mdi-open-in-app"
                  size="small"
                  :to="{ name: 'viewJob', params: { id: item.jobId } }"
                  variant="text"
                />
                <span v-else class="machine-table__empty">—</span>
              </template>

              <template #bottom />
            </v-data-table>
          </section>

          <div class="idle-machine-strip">
            <div v-if="loading" class="idle-machine-strip__state">Loading machines...</div>
            <div v-else-if="!idleMachines.length" class="idle-machine-strip__state">
              All machines currently have in-process jobs.
            </div>
            <div v-else class="idle-machine-strip__chips">
              <v-chip
                v-for="machine in idleMachines"
                :key="machine.machineId"
                class="idle-machine-strip__chip"
                color="grey-lighten-1"
                size="default"
                variant="flat"
              >
                {{ machine.machineName }}
              </v-chip>
            </div>
          </div>
        </div>
      </div>

      <v-checkbox
        v-model="idleHomeRedirectEnabled"
        class="scan-stage-shell__checkbox"
        color="primary"
        hide-details
        label="Idle Timer"
      />

      <div v-if="loadFailed" class="scan-stage-shell__error">Unable to load machine dashboard.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import logo from '@/assets/img/bk_logo.png';
import { dueDateColor, formatRelativeDate } from '@/lib/job_dates';
import api from '@/plugins/axios';
import { toastError } from '@/plugins/vue-toast-notification';
import { isAppScanReady, useIdleHomeRedirectEnabled } from '@/state/app_focus';

const idleHomeRedirectEnabled = useIdleHomeRedirectEnabled;
const loading = ref(false);
const loadFailed = ref(false);
const dashboard = ref<MachineJobDashboardResponse>({ active: [], idle: [] });

const tableHeaders = [
  { title: 'Machine', key: 'machineName', align: 'start' as const, sortable: true },
  { title: 'Job #', key: 'jobNumber', align: 'start' as const, sortable: true },
  { title: 'Qty', key: 'qty', align: 'end' as const, sortable: true },
  { title: 'Part / Description', key: 'partSummary', align: 'start' as const, sortable: true },
  { title: 'Due Date', key: 'dueDate', align: 'start' as const, sortable: true },
  { title: '', key: 'openJob', align: 'center' as const, sortable: false },
];

const activeMachines = computed(() => dashboard.value.active);
const idleMachines = computed(() => dashboard.value.idle);

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
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
}

.scan-stage-shell__checkbox {
  position: absolute;
  top: 24px;
  right: 28px;
  z-index: 3;
  background: rgba(255, 255, 255, 0.74);
  padding: 2px 10px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

.scan-stage-shell__error {
  position: absolute;
  right: 28px;
  bottom: 22px;
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
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: calc(100dvh - 92px);
}

.machine-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 32px 32px 22px;
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

.machine-table {
  flex: 1;
  min-height: 0;
  border-radius: 18px;
  overflow: hidden;
}

:global(.machine-table table) {
  background: transparent;
}

:global(.machine-table th) {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.machine-table td),
:global(.machine-table th) {
  white-space: nowrap;
}

.machine-table--active {
  background: rgba(255, 255, 255, 0.58);
}

.machine-table--idle {
  background: rgba(255, 255, 255, 0.42);
}

.machine-table__job-number {
  font-weight: 700;
}

.machine-table__qty {
  display: inline-block;
  min-width: 2ch;
  font-weight: 700;
}

.machine-table__empty {
  color: rgba(65, 59, 52, 0.58);
}

.idle-machine-strip {
  display: flex;
  align-items: flex-end;
  padding: 18px 32px 22px;
  background: linear-gradient(180deg, rgba(64, 58, 50, 0.08), rgba(36, 33, 29, 0.18));
  border-top: 1px solid rgba(50, 42, 34, 0.12);
}

.idle-machine-strip__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}

.idle-machine-strip__chip {
  color: rgba(46, 42, 38, 0.92);
  background: rgba(191, 196, 201, 0.9);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.idle-machine-strip__state {
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
  border-top-left-radius: 28px;
}

.scan-stage__corner--top-right {
  top: 0;
  right: 0;
  border-top-width: 3px;
  border-right-width: 3px;
  border-top-right-radius: 28px;
}

.scan-stage__corner--bottom-left {
  bottom: 0;
  left: 0;
  border-bottom-width: 3px;
  border-left-width: 3px;
  border-bottom-left-radius: 28px;
}

.scan-stage__corner--bottom-right {
  right: 0;
  bottom: 0;
  border-right-width: 3px;
  border-bottom-width: 3px;
  border-bottom-right-radius: 28px;
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
    border-radius: 24px;
    min-height: calc(100dvh - 84px);
  }

  .scan-stage__content {
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: calc(100dvh - 84px);
  }

  .machine-section {
    padding: 24px 18px 18px;
  }

  .idle-machine-strip {
    padding: 16px 18px 18px;
  }

  .machine-section__header {
    align-items: stretch;
    flex-direction: column;
  }

  .scan-stage-shell__checkbox {
    top: 18px;
    right: 18px;
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
