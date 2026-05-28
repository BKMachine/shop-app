<template>
  <div class="container">
    <draggable
      v-model="machines"
      class="inner-container"
      drag-class="machine--dragging"
      ghost-class="machine--ghost"
      item-key="id"
      @change="persistMachineOrder"
    >
      <template #item="{ element }">
        <div class="machine"><MachineTile :data="element" /></div>
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { io } from 'socket.io-client';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import draggable from 'vuedraggable';
import MachineTile from '@/components/MachineTile.vue';
import { statusApi } from '@/plugins/axios';

const MACHINE_ORDER_STORAGE_KEY = 'status-machine-order';

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
  if (index !== -1 && machines.value[index]) {
    machines.value[index].state = Object.assign({}, machines.value[index].state, changes);
  }
});

socket.on('status', (data: { id: string; status: MachineStatus }) => {
  const { id, status } = data;
  const index = machines.value.findIndex((x) => x.id === id);
  if (index !== -1 && machines.value[index]) {
    machines.value[index].status = status;
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
      machines.value = orderMachines(data);
      persistMachineOrder();
    })
    .catch((error) => {
      console.error('Error fetching status:', error);
    });
}

function orderMachines(data: MachineInfo[]) {
  const orderedIds = getStoredMachineOrder();

  if (!orderedIds.length) {
    return data.sort((a, b) => a.name.localeCompare(b.name));
  }

  const orderLookup = new Map(orderedIds.map((id, index) => [id, index]));

  return [...data].sort((a, b) => {
    const aIndex = orderLookup.get(a.id);
    const bIndex = orderLookup.get(b.id);

    if (aIndex !== undefined && bIndex !== undefined) {
      return aIndex - bIndex;
    }

    if (aIndex !== undefined) {
      return -1;
    }

    if (bIndex !== undefined) {
      return 1;
    }

    return a.name.localeCompare(b.name);
  });
}

function getStoredMachineOrder() {
  const storedValue = window.localStorage.getItem(MACHINE_ORDER_STORAGE_KEY);

  if (!storedValue) {
    return [] as string[];
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch (error) {
    console.warn('Unable to parse stored machine order.', error);
    return [] as string[];
  }
}

function persistMachineOrder() {
  window.localStorage.setItem(
    MACHINE_ORDER_STORAGE_KEY,
    JSON.stringify(machines.value.map((machine) => machine.id)),
  );
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

.machine {
  cursor: grab;
}

.machine--dragging {
  cursor: grabbing;
}

.machine--ghost {
  opacity: 0.5;
}
</style>
