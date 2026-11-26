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
      <v-icon
        v-if="!isOnline"
        :aria-label="offlineLabel"
        class="offline"
        color="white"
        :icon="data.state.idleOffline ? 'mdi-timer-sand-complete' : 'mdi-power-plug-off'"
        size="24"
        :title="offlineLabel"
      />
      <div class="header__end">
        <ScheduleMismatchIcon
          v-if="data.scheduleMismatch"
          class="schedule-mismatch-chip"
          :running-job-numbers="jobs.length ? jobs.map((job) => job.jobNumber) : [data.jobNumber]"
          :scheduled-job-number="data.scheduledJobNumber"
          size="12"
        />
        <img :alt="data.brand" aria-label="brand" class="logo" :src="logoSrc" />
      </div>
    </div>
    <div v-if="isOnline">
      <div class="details">
        <div v-if="isOnline" class="timer">
          <div>
            <!-- Multiple jobs: only show the chip, since the cycle time can't be tied to one job. -->
            <div v-if="hasMultipleJobs" class="job-row">
              <v-menu close-delay="200" location="bottom start" open-delay="100" open-on-hover>
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
            <!-- One line for the first alarm; the rest are counted and listed on hover. -->
            <v-tooltip
              v-if="alarmText"
              :disabled="alarmMessages.length < 2"
              location="bottom"
              open-delay="150"
            >
              <template #activator="{ props: tooltipProps }">
                <div v-bind="tooltipProps" class="alarm-row">
                  <span class="alarm" :title="alarmMessages.length < 2 ? alarmText : undefined">
                    {{ alarmText }}
                  </span>
                  <span v-if="alarmMessages.length > 1" class="extra-alarms-chip">
                    +{{ alarmMessages.length - 1 }}
                  </span>
                </div>
              </template>
              <div class="alarm-tooltip">
                <div v-for="message in alarmMessages" :key="message">{{ message }}</div>
              </div>
            </v-tooltip>
            <div v-else class="d-flex justify-space-between align-center">
              <MachineLastCycle
                :last-cycle="data.state.lastCycle"
                :macro-timer="hasMacroTimer ? macroTimer : undefined"
              />
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
    <div v-else-if="showOfflineCycleTimes" class="details offline-cycle">
      <MachineLastCycle
        :last-cycle="data.state.lastCycle"
        :macro-timer="hasMacroTimer ? macroTimer : undefined"
      />
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
import MachineLastCycle from '@/components/MachineLastCycle.vue';
import ScheduleMismatchIcon from '@/components/schedule/ScheduleMismatchIcon.vue';
import logos from '@/plugins/dynamic_logos.js';
import { alarms as alarmMutations } from '@/plugins/mutations.js';
import useNowStore from '@/stores/now.js';

const props = defineProps<{
  data: MachineInfo;
  /** Reveal the last cycle on offline tiles; online tiles always show it. */
  showOfflineCycleTimes?: boolean;
}>();
const nowStore = useNowStore();

// Idle machines can still be reached, so they get their own icon to tell them apart.
const offlineLabel = computed(() => (props.data.state.idleOffline ? 'Idle for 4 hours' : 'Offline'));

const isOnline = computed(() => {
  return props.data.state.online || false;
});

// Dark tiles use the on-dark logo where there is one; dark lettering vanishes otherwise.
const logoSrc = computed(() => {
  return (!isOnline.value && logos.brandDark[props.data.brand]) || logos.brand[props.data.brand];
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
    return (
      props.data.state.eStop === 'TRIGGERED' ||
      props.data.state.motion === 'FAULT' ||
      mtConnectFaults.value.length > 0
    );
  }
  return false;
});

const mtConnectFaults = computed<MTConnectAlarm[]>(() => {
  if (props.data.source !== 'mtconnect') return [];
  // Older status servers don't send alarms for MTConnect machines.
  return (props.data.state.alarms ?? []).filter((alarm) => alarm.level === 'FAULT');
});

const alarmMessages = computed<string[]>(() => {
  if (props.data.source === 'focas') {
    const messages = Object.values(alarms.value).map((a) => {
      const msg: string = a.message.replace(/\*/g, ' ').replace(/�/g, '').trim();
      const text = alarmMutations[msg] || msg;
      // The same alarm on several axes comes once per axis, so name the axis to tell them apart.
      return a.axis ? `${text} (${a.axis})` : text;
    });
    return [...new Set(messages)];
  } else if (props.data.source === 'mtconnect') {
    const messages = mtConnectFaults.value.map((alarm) => {
      if (alarm.message) return alarm.code ? `${alarm.code} ${alarm.message}` : alarm.message;
      return `${alarm.type.replace(/_/g, ' ')} ALARM ${alarm.code}`.trim();
    });
    if (props.data.state.eStop === 'TRIGGERED') messages.push('EMERGENCY STOP');
    return messages;
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

.header__end {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Readable on every status colour, the amber tile included. */
.schedule-mismatch-chip {
  padding: 1px 3px;
  border-radius: 4px;
  background: rgba(18, 18, 18, 0.68);
  color: #ffca28;
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
  width: 24px;
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

.alarm-row {
  align-items: center;
  display: flex;
  gap: 4px;
  /* Fill the tile without widening it: tiles size to their content, and a long alarm would. */
  min-width: 100%;
  width: 0;
}

.alarm {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extra-alarms-chip {
  flex-shrink: 0;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  background: #bd0000;
  color: #fff;
  cursor: help;
  font-size: 12px;
  line-height: 16px;
}

.alarm-tooltip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: nowrap;
}

.long-change {
  background-color: #bd0000;
}

.offline-cycle {
  margin-top: auto;
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

.machine.online.status-green .job-row--incomplete,
.machine.online.status-yellow .job-row--incomplete {
  background: rgba(22, 22, 22, 0.78);
  border-color: rgba(255, 255, 255, 0.34);
}
</style>
