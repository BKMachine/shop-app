<template>
  <div class="machine" :class="[status, { online: isOnline, alarmed: hasAlarm, blink }]">
    <div>
      <div>{{ data.name }}</div>
      <!-- <img class="logo" :src="logos.brand[data.brand]" :alt="data.brand" /> -->
    </div>
  </div>
  <!-- <div class="machine">
    <div class="header">
      <div>{{ data.name }}</div>
      <img class="logo" :src="logos.brand[data.brand]" :alt="data.brand" />
    </div>
    <div v-if="!isOnline" class="offline">
      <img :src="offlineImg" alt="OFFLINE" />
    </div>
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
import { computed } from 'vue';
import offlineImg from '@/assets/img/offline.png';
import { Duration } from 'luxon';
import logos from '@/plugins/dynamic_logos.js';
import useNowStore from '@/stores/now.js';

const props = defineProps<{
  data: MachineInfo;
}>();
const nowStore = useNowStore();

const isOnline = computed(() => {
  return props.data.state.online;
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

const lastOperatorIdle = computed(() => {
  const seconds = Math.floor(props.data.state.lastOperatorTime / 1000);
  const dur = Duration.fromObject({ seconds });
  if (dur.as('hours') > 1) return dur.toFormat('h:mm:ss');
  return dur.toFormat('m:ss');
});

const alarms = computed(() => {
  if (props.data.source === 'focas') {
    return props.data.state.alarms.concat(props.data.state.alarms2);
  } else {
    return [];
  }
});

const hasAlarm = computed(() => {
  if (props.data.source === 'focas') {
    const a1 = props.data.state.alarms || [];
    const a2 = props.data.state.alarms2 || [];
    const alarms = a1.concat(a2);
    return alarms.length > 0;
  } else if (props.data.source === 'arduino') {
    return props.data.state.red;
  } else if (props.data.source === 'mtconnect') {
    return props.data.state.eStop === 'TRIGGERED' || props.data.state.motion === 'FAULT';
  }
  return false;
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
  /* height: 120px; */
  color: #ffffff;
  padding: 5px;
  border-radius: 6px;
  /* display: flex; */
  /* flex-direction: column; */
  /* overflow-y: hidden; */
}

.machine .online {
  background: #6c6c6c;
}

.machine:not(.online) {
  background: #282828;
}

.header {
  font-size: 16px;
  /* display: flex; */
  /* align-items: center; */
  /* justify-content: space-between; */
  /* color: white; */
}

.logo {
  height: 20px;
  flex-grow: 0;
  flex-shrink: 0;
}

.offline {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 55%;
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
