<template>
  <div
    class="machine"
    :class="[status, { online: isOnline, alarmed: hasAlarm, 'blink-off': blinkOffPhase }]"
  >
    <div class="header">
      <div>
        <span class="machine-name">{{ data.name }}</span>
        <span v-if="isOnline && data.source === 'focas' && rapid" class="rapid-chip">
          {{ rapid }}
        </span>
      </div>
      <img v-if="!isOnline" alt="OFFLINE" class="offline" :src="offlineImg" />
      <img :alt="data.brand" aria-label="brand" class="logo" :src="logos.brand[data.brand]" />
    </div>
    <div v-if="isOnline">
      <div class="details">
        <div v-if="isOnline" class="timer">
          <div>
            <!-- Multiple jobs: only show the chip, since the cycle time can't be tied to one job. -->
            <div v-if="hasMultipleJobs" class="job-row">
              <v-menu location="bottom start" open-on-hover open-delay="100" close-delay="200">
                <template #activator="{ props: menuProps }">
                  <span
                    v-bind="menuProps"
                    :class="[
                      'extra-jobs-chip',
                      { 'extra-jobs-chip--incomplete': anyJobHasIncompleteData },
                    ]"
                  >
                    +{{ jobs.length }}
                  </span>
                </template>
                <div class="other-jobs-menu">
                  <div class="other-jobs-menu__title">Jobs on this machine</div>
                  <div
                    v-for="(job, index) in jobs"
                    :key="job.jobId ?? `${props.data.id}-job-${index}`"
                    :class="['job-row', { 'job-row--incomplete': job.partHasIncompleteData }]"
                    :title="job.partHasIncompleteData ? 'Part needs more cost data' : undefined"
                  >
                    <span class="job-row__label">Job:</span>
                    <span class="other-jobs-menu__job-number">
                      <RouterLink
                        v-if="job.jobId"
                        class="job-row__link"
                        :to="{ name: 'viewJob', params: { id: job.jobId } }"
                      >
                        #{{ job.jobNumber ?? '—' }}
                      </RouterLink>
                      <span v-else class="job-row__value">---</span>
                    </span>
                    <span class="job-row__separator">|</span>
                    <span class="job-row__label">Part:</span>
                    <RouterLink
                      v-if="job.partId && partText(job)"
                      class="job-row__link"
                      :to="{ name: 'viewPart', params: { id: job.partId }, query: { tab: 'cost' } }"
                    >
                      {{ partText(job) }}
                    </RouterLink>
                    <span v-else class="job-row__value">{{ partText(job) || '---' }}</span>
                  </div>
                </div>
              </v-menu>
            </div>
            <div
              v-else
              :class="['job-row', { 'job-row--incomplete': hasIncompletePartData }]"
              :title="hasIncompletePartData ? 'Part needs more cost data' : undefined"
            >
              <span class="job-row__label">Job:</span>
              <RouterLink
                v-if="data.jobId"
                class="job-row__link"
                :to="{ name: 'viewJob', params: { id: data.jobId } }"
              >
                #{{ data.jobNumber ?? '—' }}
              </RouterLink>
              <span v-else class="job-row__value">---</span>
              <span class="job-row__separator">|</span>
              <span class="job-row__label">Part:</span>
              <RouterLink
                v-if="data.partId && currentPartText"
                class="job-row__link"
                :to="{ name: 'viewPart', params: { id: data.partId }, query: { tab: 'cost' } }"
              >
                {{ currentPartText }}
              </RouterLink>
              <span v-else class="job-row__value">{{ currentPartText || '---' }}</span>
            </div>
            <div v-if="alarmText" class="alarm" :title="alarmText">{{ alarmText }}</div>
            <div v-else class="d-flex justify-space-between align-center">
              <div>
                <div v-if="hasLastCycle">
                  Last Cycle:
                  <v-tooltip v-if="cycleHistory.length > 1" location="bottom" open-delay="150">
                    <template #activator="{ props: tooltipProps }">
                      <span v-bind="tooltipProps" class="last-cycle-value last-cycle-value--hover">
                        {{ lastCycle }}
                      </span>
                    </template>
                    <div class="cycle-history-tooltip">
                      <div
                        v-for="(cycle, index) in cycleHistory"
                        :key="`${props.data.id}-cycle-${index}`"
                        :class="[
                          'cycle-history-tooltip__row',
                          index === 0 ? 'cycle-history-tooltip__row--latest' : '',
                        ]"
                      >
                        <span class="cycle-history-tooltip__index">{{ index + 1 }}.</span>
                        <span>{{ formatCycleDuration(cycle) }}</span>
                      </div>
                    </div>
                  </v-tooltip>
                  <span v-else class="last-cycle-value">{{ lastCycle }}</span>
                  <span v-if="hasMacroTimer"> ({{ macroTimer }})</span>
                </div>
                <div v-else>
                  Last Cycle: ---
                  <span v-if="hasMacroTimer"> ({{ macroTimer }})</span>
                </div>
              </div>
              <div>{{ timerText }}</div>
            </div>
            <!-- <div v-if="data.state.lastOperatorTime" :class="{ 'long-change': longChange }">
              Change Time: {{ lastOperatorIdle }}
            </div> -->
            <!-- <div v-else>Change Time: ---</div> -->
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- <div class="machine">
    
    
    <div v-else>
      <div class="details">
        <div v-if="isOnline" class="timer">
          <div>{{ timerText }}</div>
          <div v-if="!hasAlarm">
            <div v-if="data.state.lastCycle">Last Cycle: {{ lastCycle }}</div>
            <div v-else>Last Cycle: ---</div>
            <div v-if="data.state.lastOperatorTime" :class="{ 'long-change': longChange }">
              Change Time: {{ lastOperatorIdle }}
            </div>
            <div v-else>Change Time: ---</div>
          </div>
        </div>
        <div v-if="hasAlarm && data.source === 'focas'" class="alarm">
          {{ alarms[0].message.replace(/\*/g, ' ') }}
        </div>
      </div>
    </div>
  </div> -->
</template>

<script setup lang="ts">
import { Duration } from 'luxon';
import { computed } from 'vue';
import offlineImg from '@/assets/img/offline.png';
import logos from '@/plugins/dynamic_logos.js';
import { alarms as alarmMutations } from '@/plugins/mutations.js';
import useNowStore from '@/stores/now.js';

const props = defineProps<{
  data: MachineInfo;
}>();
const nowStore = useNowStore();

const isOnline = computed(() => {
  return props.data.state.online || false;
});

const seconds = computed(() => {
  const now = new Date(props.data.state.lastStateTs).valueOf();
  let seconds = Math.floor((nowStore.now.valueOf() - now) / 1000);
  if (seconds < 0) seconds = 0;
  return seconds;
});

const timerText = computed(() => {
  const dur = Duration.fromObject({ seconds: seconds.value });
  return dur.toFormat('hh:mm:ss');
});

function normalizeCycleHistory(lastCycle: MachineLastCycle) {
  if (Array.isArray(lastCycle)) {
    return lastCycle.filter((cycle) => cycle > 0);
  }

  return lastCycle > 0 ? [lastCycle] : [];
}

function formatCycleDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const dur = Duration.fromObject({ seconds });
  if (dur.as('hours') > 1) return dur.toFormat('h:mm:ss');
  return dur.toFormat('m:ss');
}

const cycleHistory = computed(() => {
  return normalizeCycleHistory(props.data.state.lastCycle);
});

const latestLastCycle = computed(() => {
  return cycleHistory.value[0] ?? 0;
});

const hasLastCycle = computed(() => {
  return latestLastCycle.value > 0;
});

const lastCycle = computed(() => {
  return formatCycleDuration(latestLastCycle.value);
});

const currentPartText = computed(() => {
  const partNumber = props.data.partNumber?.trim();
  if (partNumber) return partNumber;

  const partSummary = props.data.partSummary?.trim();
  return partSummary || '';
});

function partText(job: Pick<MachineJobSummary, 'partNumber' | 'partSummary'>) {
  return job.partNumber?.trim() || job.partSummary?.trim() || '';
}

const jobs = computed(() => {
  return props.data.jobs ?? [];
});

const hasMultipleJobs = computed(() => {
  return jobs.value.length > 1;
});

const anyJobHasIncompleteData = computed(() => {
  return jobs.value.some((job) => job.partHasIncompleteData);
});

const hasIncompletePartData = computed(() => {
  return Boolean(props.data.partHasIncompleteData);
});

const hasMacroTimer = computed(() => {
  const macroTimerMachines = ['rd1', 'rd2', 'rd3', 'rd4'];
  return macroTimerMachines.includes(props.data.name.toLowerCase());
});

const macroTimer = computed(() => {
  if (props.data.source === 'focas' && hasMacroTimer) {
    const seconds = props.data.state.macro_timer;
    const dur = Duration.fromObject({ seconds });
    if (dur.as('hours') > 1) return dur.toFormat('h:mm:ss');
    return dur.toFormat('m:ss');
  }
});

const lastOperatorIdle = computed(() => {
  const seconds = Math.floor(props.data.state.lastOperatorTime / 1000);
  const dur = Duration.fromObject({ seconds });
  if (dur.as('hours') > 1) return dur.toFormat('h:mm:ss');
  return dur.toFormat('m:ss');
});

const alarms = computed(() => {
  if (props.data.source === 'focas') {
    return Object.assign({}, props.data.state.alarms, props.data.state.alarms2);
  } else {
    return {};
  }
});

const hasAlarm = computed(() => {
  if (props.data.source === 'focas') {
    return Object.keys(alarms.value).length > 0;
  } else if (props.data.source === 'arduino') {
    return props.data.state.red;
  } else if (props.data.source === 'mtconnect') {
    return props.data.state.eStop === 'TRIGGERED' || props.data.state.motion === 'FAULT';
  }
  return false;
});

const alarmMessages = computed<string[]>(() => {
  if (props.data.source === 'focas') {
    return Object.values(alarms.value).map((a) => {
      const msg: string = a.message.replace(/\*/g, ' ').replace(/�/g, '').trim();
      return alarmMutations[msg] || msg;
    });
  } else {
    return [];
  }
});

const alarmText = computed(() => {
  return hasAlarm.value ? alarmMessages.value[0] || '' : '';
});

const shouldBlink = computed(() => {
  return isOnline.value && status.value === 'status-red' && seconds.value >= 60 * 15;
});

const blinkOffPhase = computed(() => {
  return shouldBlink.value && Math.floor(nowStore.now.valueOf() / 1000) % 2 === 1;
});

const longChange = computed(() => {
  const seconds = Math.floor(props.data.state.lastOperatorTime / 1000);
  return isOnline.value && seconds >= 60 * 15;
});

const status = computed(() => {
  return `status-${props.data.status}`;
});

const rapid = computed(() => {
  if (props.data.source === 'focas') {
    switch (props.data.state.rapid) {
      case 0:
        return '100%';
      case 1:
        return '50%';
      case 2:
        return '25%';
      case 3:
        return 'LOW';
      default:
        return '';
    }
  }
});
</script>

<style scoped>
.machine {
  min-width: 280px;
  max-width: 400px;
  height: 78px;
  color: #ffffff;
  padding: 5px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow-y: hidden;
  position: relative;
}

.machine.online {
  background: #6c6c6c;
}

.machine:not(.online) {
  background: #282828;
}

.job-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  line-height: 1.1;
}

.job-row__link,
.job-row__value,
.job-row__label,
.job-row__separator {
  font-size: 12px;
}

.job-row__link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.header {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
}

.machine-name {
  font-family: "Roboto Mono", monospace;
}

.logo {
  height: 20px;
  flex-grow: 0;
  flex-shrink: 0;
}

.rapid-chip {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
  margin-bottom: 2px;
  min-height: 16px;
  padding: 0 5px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(18, 18, 18, 0.55);
  color: #f5f5f5;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
  vertical-align: middle;
}

.extra-jobs-chip {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  background: #1565c0;
  color: #fff;
  cursor: help;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
}

/* Dark + amber (not solid amber) so it still stands out on yellow tiles. */
.extra-jobs-chip--incomplete {
  border-color: #f0a830;
  background: rgba(18, 18, 18, 0.68);
  color: #d7ecff;
}

.other-jobs-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #2b2b2b;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.other-jobs-menu__title {
  font-size: 11px;
  opacity: 0.7;
}

.details {
  font-size: 14px;
}

.job-row {
  align-items: center;
  display: inline-flex;
  gap: 4px;
  line-height: 1.2;
  min-width: 0;
  white-space: nowrap;
}

.job-row--incomplete {
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  background: rgba(18, 18, 18, 0.68);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
}

.machine.online.status-green .job-row--incomplete,
.machine.online.status-yellow .job-row--incomplete {
  background: rgba(22, 22, 22, 0.78);
  border-color: rgba(255, 255, 255, 0.34);
}

.job-row__label,
.job-row__separator,
.job-row__value {
  color: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.job-row__link,
.job-row__value:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.job-row__link {
  color: #ffffff;
  text-decoration: underline;
}

.job-row__link:hover {
  color: #d7ecff;
}

.offline {
  height: 24px;
  position: absolute;
  left: 15%;
}

.offline img {
  height: 70px;
}

.machine.online.status-green {
  background: #287428;
}

.machine.online.status-yellow {
  background: #e89a23;
}

.machine.online.status-red {
  background: #bd0000;
}

.machine.online.status-red.blink-off {
  background: #6c6c6c;
}

.alarm {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.long-change {
  background-color: #bd0000;
}

.last-cycle-value {
  display: inline-block;
}

.last-cycle-value--hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.cycle-history-tooltip {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cycle-history-tooltip__row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.cycle-history-tooltip__row--latest {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cycle-history-tooltip__index {
  min-width: 1.25rem;
  opacity: 0.7;
}

.other-jobs-menu .job-row {
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 999px;
}

/* Room for "#" + a 4-digit job number so the "|" delimiters line up. */
.other-jobs-menu__job-number {
  display: inline-block;
  flex-shrink: 0;
  min-width: 4.6ch;
  font-size: 12px; /* match the link so `ch` is measured in the same font size */
  font-variant-numeric: tabular-nums;
}

.other-jobs-menu .job-row--incomplete {
  background: rgba(232, 154, 35, 0.22);
  border-color: rgba(232, 154, 35, 0.75);
  box-shadow: none;
}
</style>
