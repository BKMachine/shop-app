<template>
  <div class="container">
    <div class="inner-container">
      <div v-for="machine in machines" :key="machine.id" class="machine">
        <MachineTile :data="machine" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { io } from 'socket.io-client';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import MachineTile from '@/components/MachineTile.vue';
import { statusApi } from '@/plugins/axios';

const machines = ref<MachineInfo[]>([]);

const socket = io(import.meta.env.VITE_STATUS_API_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
});

socket.io.on('reconnect', () => {
  console.log('Socket-IO client reconnected.');
  fetchMachines();
});

socket.on('change', (status: { id: string; changes: Changes }) => {
  const { id, changes } = status;
  const index = machines.value.findIndex((x) => x.id === id);
  if (index !== -1) {
    let currentState = machines.value[index]?.state;
    if (currentState) currentState = Object.assign({}, currentState, changes);
  }
});

socket.on('status', (data: { id: string; status: MachineStatus }) => {
  const { id, status } = data;
  const index = machines.value.findIndex((x) => x.id === id);
  if (index !== -1) {
    let currentStatus = machines.value[index]?.status;
    if (currentStatus) currentStatus = status;
  }
});

socket.on('refresh-data', () => {
  fetchMachines();
});

onMounted(async () => {
  await fetchMachines();
  socket.connect();
});

onBeforeUnmount(() => {
  socket.disconnect();
});

async function fetchMachines() {
  statusApi
    .get<MachineInfo[]>('/machines')
    .then(({ data }) => {
      machines.value = data.sort((a, b) => a.name.localeCompare(b.name));
    })
    .catch((error) => {
      console.error('Error fetching status:', error);
    });
}
</script>

<style scoped>
.container {
  display: flex;
  padding: 20px;
}
.inner-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
