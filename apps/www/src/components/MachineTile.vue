<template>
  <div class="machine" :class="[status, { online: isOnline, alarmed: hasAlarm, blink }]">
   <div class="header">
      <div>{{ data.name }}</div>
      <img v-if="!isOnline" class="offline" :src="offlineImg" alt="OFFLINE" />
      <img class="logo" :src="logos.brand[data.brand]" :alt="data.brand" />
    </div>
    <div v-if="isOnline">
<div class="details">
        <div v-if="isOnline" class="timer">
          <div v-if="!hasAlarm">
            <div class="d-flex justify-space-between align-center">
              <div>
                <div v-if="props.data.state.lastCycle">Last Cycle: {{ lastCycle }}
                  <span v-if="hasMacroTimer"> ({{ macroTimer }})</span>
                </div>
                <div v-else>Last Cycle: ---
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
        <div v-if="hasAlarm && data.source === 'focas'" class="alarm">
          {{ alarmMessages[0] }}
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
import {alarms as alarmMutations} from '@/plugins/mutations.js';
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

const lastCycle = computed(() => {
  const seconds = Math.floor(props.data.state.lastCycle / 1000);
  const dur = Duration.fromObject({ seconds });
  if (dur.as('hours') > 1) return dur.toFormat('h:mm:ss');
  return dur.toFormat('m:ss');
});

const hasMacroTimer = computed(() => {
  const macroTimerMachines = ['rd1', 'rd2', 'rd3'];
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
    return Object.values(alarms.value).map((a: any) => {
      const msg: string = a.message.replace(/\*/g, ' ').trim();
      return alarmMutations[msg] || msg;
  });
  } else {
    return [];
  }
});

const blink = computed(() => {
  return isOnline.value && status.value === 'status-red' && seconds.value >= 60 * 15;
});

const longChange = computed(() => {
  const seconds = Math.floor(props.data.state.lastOperatorTime / 1000);
  return isOnline.value && seconds >= 60 * 15;
});

const status = computed(() => {
  return `status-${props.data.status}`;
});
</script>

<style scoped>
.machine {
  width: 300px;
  height: 60px;
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

.header {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
}

.logo {
  height: 20px;
  flex-grow: 0;
  flex-shrink: 0;
}

.details {
  font-size: 14px;
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

.blink {
  animation: blinkingAlarm 2s infinite;
}

@keyframes blinkingAlarm {
  0% {
    background-color: #bd0000;
  }
  50% {
    background-color: #bd0000;
  }
  51% {
    background-color: #6c6c6c;
  }
  100% {
    background-color: #6c6c6c;
  }
}

.long-change {
  background-color: #bd0000;
}
</style>
