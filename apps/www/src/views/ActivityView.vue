<template>
  <div class="container">
    <div class="stats-header">
      <h1 class="stats-title">Tool Cost Summary</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Yesterday</div>
          <div class="stat-value">${{ toolCosts.yesterday.toFixed(2) }}</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-label">Today</div>
          <div class="stat-value">${{ toolCosts.today.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <div class="activities-grid">
      <div class="activity-column">
        <h2 class="column-title">Tools</h2>
        <div v-if="toolActivities.length === 0" class="no-data">No activity</div>
        <template v-for="dayGroup in toolActivitiesGroupedByDay" :key="dayGroup.date">
          <div class="day-header">{{ dayGroup.date }}</div>
          <v-card
            v-for="activity in dayGroup.activities"
            :key="activity._id"
            :class="['activity-card', { 'recent-activity-card': isRecentActivity(activity.timestamp) }]"
          >
            <v-card-text class="card-content">
              <v-row class="align-center" no-gutters>
                <v-col class="image-col" cols="3">
                  <div class="activity-image-frame">
                    <img alt="Tool" class="activity-image" :src="activity.new.img" />
                  </div>
                </v-col>

                <v-col class="info-col" cols="auto">
                  <div class="item-title">{{ activity.new.description }}</div>
                  <div class="activity-meta">
                    <span
                      :class="`amount ${activity.changeType === 'increase' ? 'increase' : 'decrease'}`"
                    >
                      {{ activity.changeType === 'increase' ? '+' : '−' }}{{ activity.amount }}
                    </span>
                    <span class="stock-info">{{ activity.new.stock }}</span>
                    <span class="cost-badge"
                      >${{ (activity.amount * activity.new.cost).toFixed(2) }}</span
                    >
                    <span v-if="getDeviceIcon(activity.device)" class="device-indicator">
                      <v-icon :icon="getDeviceIcon(activity.device)" size="14" />
                      <v-tooltip activator="parent" location="top" open-delay="250">
                        {{ getDeviceName(activity.device) }}
                      </v-tooltip>
                    </span>
                    <span
                      v-if="activity.mergedCount && activity.mergedCount > 1"
                      class="merge-badge"
                    >
                      {{ activity.mergedCount }}
                      audits merged
                    </span>
                  </div>
                  <div class="timestamp">{{ formatTimestamp(activity.timestamp) }}</div>
                </v-col>

                <v-col class="action-col" cols="auto">
                  <v-btn
                    class="action-btn"
                    icon
                    size="x-small"
                    title="View tool details"
                    @click="openInventory(activity.new, 'tool')"
                  >
                    <v-icon icon="mdi-arrow-top-right" size="small" />
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </template>
      </div>

      <div class="activity-column">
        <h2 class="column-title">Parts</h2>
        <div v-if="partActivities.length === 0" class="no-data">No activity</div>
        <template v-for="dayGroup in partActivitiesGroupedByDay" :key="dayGroup.date">
          <div class="day-header">{{ dayGroup.date }}</div>
          <v-card
            v-for="activity in dayGroup.activities"
            :key="activity._id"
            :class="['activity-card', { 'recent-activity-card': isRecentActivity(activity.timestamp) }]"
          >
            <v-card-text class="card-content">
              <v-row class="align-center" no-gutters>
                <v-col class="image-col" cols="3">
                  <div class="activity-image-frame">
                    <img alt="Part" class="activity-image" :src="activity.new.img" />
                  </div>
                </v-col>

                <v-col class="info-col" cols="auto">
                  <div class="item-title">{{ activity.new.part }}</div>
                  <div class="item-subtitle">{{ activity.new.description }}</div>
                  <div class="activity-meta">
                    <span
                      :class="`amount ${activity.changeType === 'increase' ? 'increase' : 'decrease'}`"
                    >
                      {{ activity.changeType === 'increase' ? '+' : '−' }}{{ activity.amount }}
                    </span>
                    <span class="stock-info">{{ activity.new.stock }}</span>
                    <span v-if="getDeviceIcon(activity.device)" class="device-indicator">
                      <v-icon :icon="getDeviceIcon(activity.device)" size="14" />
                      <v-tooltip activator="parent" location="top" open-delay="250">
                        {{ getDeviceName(activity.device) }}
                      </v-tooltip>
                    </span>
                    <span
                      v-if="activity.mergedCount && activity.mergedCount > 1"
                      class="merge-badge"
                    >
                      {{ activity.mergedCount }}
                      audits merged
                    </span>
                  </div>
                  <div class="timestamp">{{ formatTimestamp(activity.timestamp) }}</div>
                </v-col>

                <v-col class="action-col" cols="auto">
                  <v-btn
                    class="action-btn"
                    icon
                    size="x-small"
                    title="View part details"
                    @click="openInventory(activity.new, 'part')"
                  >
                    <v-icon icon="mdi-arrow-top-right" size="small" />
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </template>
      </div>

      <div class="activity-column">
        <h2 class="column-title">Jobs</h2>
        <div v-if="jobActivities.length === 0" class="no-data">No activity</div>
        <template v-for="dayGroup in jobActivitiesGroupedByDay" :key="dayGroup.date">
          <div class="day-header">{{ dayGroup.date }}</div>
          <v-card
            v-for="activity in dayGroup.activities"
            :key="activity._id"
            :class="['activity-card', { 'recent-activity-card': isRecentActivity(activity.timestamp) }]"
          >
            <v-card-text class="card-content">
              <v-row class="align-center" no-gutters>
                <v-col class="image-col" cols="3">
                  <div class="activity-image-frame">
                    <img
                      v-if="activity.partImage"
                      alt="Job part"
                      class="activity-image"
                      :src="activity.partImage"
                    />
                    <div v-else class="job-image-fallback">
                      <v-icon icon="mdi-briefcase-outline" size="18" />
                    </div>
                  </div>
                </v-col>

                <v-col class="info-col" cols="auto">
                  <div class="job-title-row">
                    <div class="item-title">{{ getJobActivityTitle(activity) }}</div>
                    <span :class="['job-event-badge', `job-event-badge-${activity.activityType}`]">
                      <v-icon :icon="getJobActivityIcon(activity.activityType)" size="14" />
                      {{ getJobActivityLabel(activity.activityType) }}
                    </span>
                  </div>
                  <div class="item-subtitle">{{ getJobActivitySubtitle(activity) }}</div>
                  <div class="activity-meta">
                    <span class="job-badge">Job #{{ activity.jobNumber }}</span>
                    <span v-if="activity.machineName" class="machine-badge">
                      {{ activity.machineName }}
                    </span>
                    <span v-if="activity.machineType" class="stock-info">
                      {{ formatMachineType(activity.machineType) }}
                    </span>
                    <span v-if="getDeviceIcon(activity.device)" class="device-indicator">
                      <v-icon :icon="getDeviceIcon(activity.device)" size="14" />
                      <v-tooltip activator="parent" location="top" open-delay="250">
                        {{ getDeviceName(activity.device) }}
                      </v-tooltip>
                    </span>
                  </div>
                  <div class="timestamp">{{ formatTimestamp(activity.timestamp) }}</div>
                </v-col>

                <v-col class="action-col" cols="auto">
                  <v-btn
                    class="action-btn"
                    :disabled="!activity.jobId"
                    icon
                    size="x-small"
                    title="View job details"
                    @click="openJob(activity.jobId)"
                  >
                    <v-icon icon="mdi-arrow-top-right" size="small" />
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import router from '@/router';

type InventoryActivity = Audit & {
  changeType: 'increase' | 'decrease' | 'no_change';
  amount: number;
};

type JobActivityType = 'created' | 'closed' | 'task_started' | 'task_stopped';

type JobActivity = {
  _id: string;
  auditId: string;
  timestamp: string;
  activityType: JobActivityType;
  device: Audit['device'];
  jobId: string | null;
  jobNumber: number | string;
  customerName: string;
  partSummary: string;
  partImage: string | null;
  machineName: string;
  machineType: MachineType | null;
};

type DayGroup<T> = {
  date: string;
  activities: T[];
};

const toolAudits = ref<Audit[]>([]);
const partAudits = ref<Audit[]>([]);
const jobAudits = ref<Audit[]>([]);
const to = ref<DateTime>(DateTime.now());
const now = ref(DateTime.now());
const from = computed<DateTime>(() => DateTime.now().minus({ days: 7 }));
const toolCosts = ref<{ today: number; yesterday: number }>({ today: 0, yesterday: 0 });
let recentActivityTimer: ReturnType<typeof setInterval> | null = null;

const toolActivities = computed(() => transformInventoryAudits(toolAudits.value));
const toolActivitiesGroupedByDay = computed(() => groupActivitiesByDay(toolActivities.value));

const partActivities = computed(() => transformInventoryAudits(partAudits.value));
const partActivitiesGroupedByDay = computed(() => groupActivitiesByDay(partActivities.value));

const jobActivities = computed(() => transformJobAudits(jobAudits.value));
const jobActivitiesGroupedByDay = computed(() => groupActivitiesByDay(jobActivities.value));

onMounted(() => {
  refreshAudits();
  socket.on('audit', refreshAudits);
  recentActivityTimer = setInterval(() => {
    now.value = DateTime.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  socket.off('audit', refreshAudits);
  if (recentActivityTimer) {
    clearInterval(recentActivityTimer);
    recentActivityTimer = null;
  }
});

function getDeviceName(device: Audit['device'] | string | null | undefined) {
  if (!device || typeof device === 'string') return 'Unknown device';
  return device.displayName || 'Unknown device';
}

function getDeviceIcon(device: Audit['device'] | string | null | undefined) {
  if (!device || typeof device === 'string') return undefined;
  if (device.deviceType === 'pc') {
    return device.displayName?.toLowerCase().includes('kiosk') ? 'mdi-tablet' : 'mdi-monitor';
  }
  if (device.deviceType === 'android') return 'mdi-android';
  return undefined;
}

function formatTimestamp(timestamp: string) {
  const dateTime = DateTime.fromISO(timestamp);
  if (!dateTime.isValid) return new Date(timestamp).toLocaleString();
  return dateTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
}

function isRecentActivity(timestamp: string) {
  const dateTime = DateTime.fromISO(timestamp);
  if (!dateTime.isValid) return false;
  return now.value.diff(dateTime, 'hours').hours <= 1;
}

function transformInventoryAudits(audits: Audit[]): InventoryActivity[] {
  return audits
    .map((audit) => {
      const oldStock = audit.old?.stock ?? 0;
      const newStock = audit.new?.stock ?? 0;
      const diff = newStock - oldStock;
      const changeType: InventoryActivity['changeType'] =
        diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'no_change';

      return {
        ...audit,
        changeType,
        amount: Math.abs(diff),
      } as InventoryActivity;
    })
    .filter((audit) => audit.changeType !== 'no_change')
    .sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
}

function groupActivitiesByDay<T extends { timestamp: string }>(activities: T[]): DayGroup<T>[] {
  const grouped = new Map<string, T[]>();

  activities.forEach((activity) => {
    const dateKey = new Date(activity.timestamp).toLocaleDateString();
    grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), activity]);
  });

  return Array.from(grouped.entries()).map(([date, groupedActivities]) => ({
    date,
    activities: groupedActivities,
  }));
}

function normalizeJobRecord(value: unknown): Partial<Job> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Partial<Job>;
}

function getJobTasks(job: Partial<Job>): JobProductionTask[] {
  return Array.isArray(job.productionTasks) ? job.productionTasks : [];
}

function getJobTaskMap(tasks: JobProductionTask[]) {
  return new Map(tasks.map((task) => [task.id, task]));
}

function getJobId(job: Partial<Job>) {
  return typeof job._id === 'string' ? job._id : null;
}

function getJobNumber(job: Partial<Job>) {
  return typeof job.jobNumber === 'number' ? job.jobNumber : 'Unknown';
}

function getJobCustomerName(job: Partial<Job>) {
  if (job.customerName) return job.customerName;
  if (job.customer && typeof job.customer !== 'string' && job.customer.name) {
    return job.customer.name;
  }
  return '';
}

function getJobPartSummary(job: Partial<Job>) {
  const partNumber =
    job.partNumber || (job.part && typeof job.part !== 'string' ? job.part.part || '' : '');
  const partDescription =
    job.partDescription ||
    (job.part && typeof job.part !== 'string' ? job.part.description || '' : '');

  return [partNumber, partDescription].filter(Boolean).join(' - ');
}

function getJobPartImage(job: Partial<Job>) {
  if ('partImage' in job && typeof job.partImage === 'string' && job.partImage.trim()) {
    return job.partImage.trim();
  }

  if (
    job.part &&
    typeof job.part !== 'string' &&
    typeof job.part.img === 'string' &&
    job.part.img
  ) {
    return job.part.img;
  }

  return null;
}

function toEventTimestamp(value: string | Date | null | undefined, fallback: string) {
  if (typeof value === 'string') {
    const dateTime = DateTime.fromISO(value);
    if (dateTime.isValid) return dateTime.toISO() ?? fallback;
  }

  if (value instanceof Date) {
    const dateTime = DateTime.fromJSDate(value);
    if (dateTime.isValid) return dateTime.toISO() ?? fallback;
  }

  return fallback;
}

function transformJobAudits(audits: Audit[]): JobActivity[] {
  return audits
    .flatMap((audit) => {
      const oldJob = normalizeJobRecord(audit.old);
      const newJob = normalizeJobRecord(audit.new);
      const job = Object.keys(newJob).length ? newJob : oldJob;
      const jobId = getJobId(job);
      const jobNumber = getJobNumber(job);
      const customerName = getJobCustomerName(job);
      const partSummary = getJobPartSummary(job);
      const partImage = getJobPartImage(job);
      const events: JobActivity[] = [];

      if (!audit.old && audit.new) {
        events.push({
          _id: `${audit._id}:created`,
          auditId: audit._id,
          timestamp: toEventTimestamp(newJob.createdAt, audit.timestamp),
          activityType: 'created',
          device: audit.device,
          jobId,
          jobNumber,
          customerName,
          partSummary,
          partImage,
          machineName: '',
          machineType: null,
        });
      }

      if (oldJob.status !== 'closed' && newJob.status === 'closed') {
        events.push({
          _id: `${audit._id}:closed`,
          auditId: audit._id,
          timestamp: toEventTimestamp(newJob.completedOn, audit.timestamp),
          activityType: 'closed',
          device: audit.device,
          jobId,
          jobNumber,
          customerName,
          partSummary,
          partImage,
          machineName: '',
          machineType: null,
        });
      }

      const oldTasks = getJobTaskMap(getJobTasks(oldJob));
      const newTasks = getJobTaskMap(getJobTasks(newJob));

      newTasks.forEach((task, taskId) => {
        if (!oldTasks.has(taskId)) {
          events.push({
            _id: `${audit._id}:task-started:${taskId}`,
            auditId: audit._id,
            timestamp: toEventTimestamp(task.startedAt, audit.timestamp),
            activityType: 'task_started',
            device: audit.device,
            jobId,
            jobNumber,
            customerName,
            partSummary,
            partImage,
            machineName: task.machineName,
            machineType: task.machineType,
          });
          return;
        }

        const previousTask = oldTasks.get(taskId);
        if (previousTask?.endedAt || !task.endedAt) return;

        events.push({
          _id: `${audit._id}:task-stopped:${taskId}`,
          auditId: audit._id,
          timestamp: toEventTimestamp(task.endedAt, audit.timestamp),
          activityType: 'task_stopped',
          device: audit.device,
          jobId,
          jobNumber,
          customerName,
          partSummary,
          partImage,
          machineName: task.machineName,
          machineType: task.machineType,
        });
      });

      return events;
    })
    .sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
}

function getJobActivityIcon(activityType: JobActivityType) {
  if (activityType === 'created') return 'mdi-briefcase-plus';
  if (activityType === 'closed') return 'mdi-briefcase-check';
  if (activityType === 'task_started') return 'mdi-play-circle';
  return 'mdi-stop-circle';
}

function getJobActivityLabel(activityType: JobActivityType) {
  if (activityType === 'created') return 'Created';
  if (activityType === 'closed') return 'Closed';
  if (activityType === 'task_started') return 'Task started';
  return 'Task stopped';
}

function getJobActivityTitle(activity: JobActivity) {
  return activity.partSummary || `Job #${activity.jobNumber}`;
}

function getJobActivitySubtitle(activity: JobActivity) {
  const details = [activity.customerName].filter(Boolean);

  if (activity.machineName) {
    details.push(
      activity.activityType === 'task_started'
        ? `Started on ${activity.machineName}`
        : `Stopped on ${activity.machineName}`,
    );
  }

  if (activity.activityType === 'created') details.push('Job created');
  if (activity.activityType === 'closed') details.push('Job closed');

  return details.join(' • ') || `Job #${activity.jobNumber}`;
}

function formatMachineType(machineType: MachineType | null) {
  if (!machineType) return '';
  if (machineType === 'mill') return 'Mill';
  if (machineType === 'lathe') return 'Lathe';
  return 'Swiss';
}

async function refreshAudits() {
  to.value = DateTime.now();
  await Promise.all([getToolCosts(), getAudits('tools'), getAudits('parts'), getAudits('jobs')]);
}

async function getAudits(type: 'tools' | 'parts' | 'jobs') {
  const response = await api.post(`/audits/${type}`, {
    from: from.value.toISO(),
    to: to.value.toISO(),
  });

  if (type === 'tools') {
    toolAudits.value = response.data;
    return;
  }

  if (type === 'parts') {
    partAudits.value = response.data;
    return;
  }

  jobAudits.value = response.data;
}

async function getToolCosts() {
  const now = DateTime.now();
  const startOfDay = now.startOf('day');
  let startOfYesterday = startOfDay.minus({ days: 1 });

  if (now.weekday === 1) {
    startOfYesterday = startOfYesterday.minus({ days: 2 });
  }

  function calcCosts(response: { data: Audit[] }) {
    const audits: Audit[] = response.data;
    const costs: Record<string, number> = {};

    audits
      .filter((audit) => {
        const oldStock = audit.old?.stock ?? 0;
        const newStock = audit.new?.stock ?? 0;
        return oldStock > newStock;
      })
      .forEach((audit) => {
        const toolId = audit.new._id;
        if (!costs[toolId]) costs[toolId] = 0;

        const oldStock = audit.old?.stock ?? 0;
        const newStock = audit.new?.stock ?? 0;
        const diff = newStock - oldStock;
        if (diff !== 0) {
          costs[toolId] += Math.abs(diff) * audit.new.cost;
        }
      });

    return costs;
  }

  const todayCosts = await api
    .post('/audits/tools', { from: startOfDay.toISO(), to: now.toISO() })
    .then(calcCosts);

  const yesterdayCosts = await api
    .post('/audits/tools', { from: startOfYesterday.toISO(), to: startOfDay.toISO() })
    .then(calcCosts);

  toolCosts.value = {
    today: Object.values(todayCosts).reduce((sum, cost) => sum + cost, 0),
    yesterday: Object.values(yesterdayCosts).reduce((sum, cost) => sum + cost, 0),
  };
}

function openInventory(item: Tool | Part, type: 'tool' | 'part') {
  const routeName = type === 'tool' ? 'viewTool' : 'viewPart';
  router.push({ name: routeName, params: { id: item._id } });
}

function openJob(jobId: string | null) {
  if (!jobId) return;
  router.push({ name: 'viewJob', params: { id: jobId } });
}
</script>

<style scoped>
.container {
  max-width: 1560px;
  margin: 0 auto;
  padding: 12px 8px;
}

.stats-header {
  margin-bottom: 12px;
}

.stats-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.stat-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 6px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-card.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.stat-card.highlight .stat-label {
  opacity: 0.9;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.activities-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.activity-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.column-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  padding: 0 4px;
}

.day-header {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #95a5a6;
  padding: 8px 2px 4px 2px;
  margin-top: 8px;
  border-top: 1px solid #ecf0f1;
}

.day-header:first-child {
  margin-top: 0;
  border-top: none;
  padding-top: 0;
}

.no-data {
  text-align: center;
  padding: 24px 12px;
  color: #95a5a6;
  font-size: 14px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #ecf0f1;
}

.activity-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8eef5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  overflow: hidden;
}

.activity-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #d0dce6;
}

.recent-activity-card {
  background: linear-gradient(180deg, #fff8ea 0%, #fff3e1 100%);
  border-color: #ecd2aa;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    0 1px 3px rgba(158, 111, 27, 0.04);
}

.recent-activity-card:hover {
  border-color: #e0bf8f;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 2px 8px rgba(158, 111, 27, 0.08);
}

.card-content {
  padding: 8px;
}

.image-col {
  flex-shrink: 0;
}

.activity-image-frame {
  width: 120px;
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 6px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%);
  border: 1px solid #dde6ef;
  overflow: hidden;
}

.activity-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.job-image-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7d8ea1;
}

.job-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.job-event-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  padding: 4px 7px;
  border-radius: 999px;
}

.job-event-badge-created {
  color: #1f8f53;
  background: #dbf5e7;
}

.job-event-badge-closed {
  color: #1f5fb4;
  background: #e1efff;
}

.job-event-badge-task_started {
  color: #a85d12;
  background: #fff0de;
}

.job-event-badge-task_stopped {
  color: #b13535;
  background: #fde3e3;
}

.info-col {
  padding: 0 8px;
  min-width: 0;
  flex: 1;
}

.item-title {
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 3px;
  line-height: 1.2;
  word-break: break-word;
}

.item-subtitle {
  font-size: 12px;
  color: #607182;
  margin-bottom: 4px;
  line-height: 1.25;
  word-break: break-word;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}

.amount {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  letter-spacing: -0.1px;
  white-space: nowrap;
}

.amount.increase {
  color: #27ae60;
  background: #d5f4e6;
}

.amount.decrease {
  color: #e74c3c;
  background: #fadbd8;
}

.stock-info {
  font-size: 11px;
  color: #7f8c8d;
  font-weight: 500;
}

.cost-badge,
.job-badge,
.machine-badge,
.merge-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
}

.cost-badge {
  color: #667eea;
  background: #f0f3ff;
}

.job-badge {
  color: #2f5e9e;
  background: #e7f0ff;
}

.machine-badge {
  color: #8a4f08;
  background: #fff1df;
}

.merge-badge {
  background: #e8f1fb;
  color: #315a7d;
}

.device-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7890ab;
  width: 16px;
  height: 16px;
  cursor: help;
  transition: color 0.2s ease;
}

.device-indicator:hover {
  color: #4e6d8f;
}

.timestamp {
  font-size: 10px;
  color: #95a5a6;
  font-weight: 400;
  line-height: 1.2;
}

.action-col {
  padding-left: 8px;
  flex-shrink: 0;
}

.action-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: scale(1.12);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

@media (max-width: 1200px) {
  .activities-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .activities-grid {
    grid-template-columns: 1fr;
  }

  .activity-image-frame {
    width: 76px;
    height: 76px;
  }

  .job-title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .container {
    padding: 12px 8px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .card-content {
    padding: 10px;
  }

  .activity-image-frame {
    width: 64px;
    height: 64px;
  }

  .info-col {
    padding: 0 8px;
  }
}
</style>
