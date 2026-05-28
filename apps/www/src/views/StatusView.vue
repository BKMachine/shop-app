<template>
  <div class="container">
    <draggable
      v-model="tiles"
      class="inner-container"
      drag-class="machine--dragging"
      ghost-class="machine--ghost"
      item-key="id"
      @change="persistMachineOrder"
    >
      <template #item="{ element }">
        <div :class="['machine', { 'machine--blank': isBlankTile(element) }]">
          <MachineTile v-if="!isBlankTile(element)" :data="element" />
          <div v-else class="blank-tile"><span class="blank-tile__label">Blank Tile</span></div>
        </div>
      </template>
    </draggable>

    <v-menu location="top end">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          class="settings-button"
          color="surface"
          elevation="8"
          icon="mdi-cog-outline"
        />
      </template>

      <v-list density="comfortable" min-width="220">
        <v-list-item
          prepend-icon="mdi-plus-box-outline"
          title="Add Blank Tile"
          @click="addBlankTile"
        />
        <v-list-item
          prepend-icon="mdi-refresh"
          title="Reset Order"
          @click="openResetOrderConfirm"
        />
        <v-list-item prepend-icon="mdi-cog-outline" title="Machines" @click="openSettings" />
      </v-list>
    </v-menu>

    <ConfirmDialog
      v-model="resetOrderConfirmVisible"
      confirm-text="Reset Order"
      message="Reset the machine tile order back to the default alphabetical layout?"
      title="Reset Machine Order"
      @confirm="resetMachineOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { io } from 'socket.io-client';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import MachineTile from '@/components/MachineTile.vue';
import { statusApi } from '@/plugins/axios';

const MACHINE_ORDER_STORAGE_KEY = 'status-machine-order';
const BLANK_TILE_PREFIX = 'blank:';

type StatusTile = MachineInfo | BlankMachineTile;

const router = useRouter();
const tiles = ref<StatusTile[]>([]);
const resetOrderConfirmVisible = ref(false);

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
  const index = tiles.value.findIndex((tile) => !isBlankTile(tile) && tile.id === id);
  if (index !== -1 && tiles.value[index] && !isBlankTile(tiles.value[index])) {
    tiles.value[index].state = Object.assign({}, tiles.value[index].state, changes);
  }
});

socket.on('status', (data: { id: string; status: MachineStatus }) => {
  const { id, status } = data;
  const index = tiles.value.findIndex((tile) => !isBlankTile(tile) && tile.id === id);
  if (index !== -1 && tiles.value[index] && !isBlankTile(tiles.value[index])) {
    tiles.value[index].status = status;
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
      tiles.value = orderMachines(data);
      persistMachineOrder();
    })
    .catch((error) => {
      console.error('Error fetching status:', error);
    });
}

function orderMachines(data: MachineInfo[]) {
  const orderedIds = getStoredMachineOrder();
  const sortedMachines = [...data].sort((a, b) => a.name.localeCompare(b.name));

  if (!orderedIds.length) {
    return sortedMachines;
  }

  const machineLookup = new Map(sortedMachines.map((machine) => [machine.id, machine]));
  const seenMachineIds = new Set<string>();
  const orderedTiles: StatusTile[] = [];

  for (const id of orderedIds) {
    if (id.startsWith(BLANK_TILE_PREFIX)) {
      orderedTiles.push(createBlankTile(id));
      continue;
    }

    const machine = machineLookup.get(id);
    if (machine) {
      orderedTiles.push(machine);
      seenMachineIds.add(id);
    }
  }

  for (const machine of sortedMachines) {
    if (!seenMachineIds.has(machine.id)) {
      orderedTiles.push(machine);
    }
  }

  return orderedTiles;
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
    JSON.stringify(tiles.value.map((tile) => tile.id)),
  );
}

function addBlankTile() {
  tiles.value = [...tiles.value, createBlankTile()];
  persistMachineOrder();
}

function openSettings() {
  router.push({ name: 'statusSettings' });
}

function openResetOrderConfirm() {
  resetOrderConfirmVisible.value = true;
}

function resetMachineOrder() {
  window.localStorage.removeItem(MACHINE_ORDER_STORAGE_KEY);
  tiles.value = tiles.value
    .filter((tile): tile is MachineInfo => !isBlankTile(tile))
    .sort((a, b) => a.name.localeCompare(b.name));
  resetOrderConfirmVisible.value = false;
}

function isBlankTile(tile: StatusTile): tile is BlankMachineTile {
  return 'blank' in tile && tile.blank === true;
}

function createBlankTile(id = `${BLANK_TILE_PREFIX}${crypto.randomUUID()}`): BlankMachineTile {
  return {
    blank: true,
    id,
    index: -1,
  };
}
</script>

<style scoped>
.container {
  display: flex;
  padding: 20px;
}
.inner-container {
  align-content: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.machine {
  cursor: grab;
}

.machine--blank {
  height: 60px;
  width: 300px;
}

.machine--dragging {
  cursor: grabbing;
}

.machine--ghost {
  opacity: 0.5;
}

.blank-tile {
  align-items: center;
  border: 1px dashed transparent;
  border-radius: 6px;
  display: flex;
  height: 100%;
  justify-content: center;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
  width: 100%;
}

.blank-tile__label {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.machine--blank:hover .blank-tile,
.machine--blank:focus-within .blank-tile {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-on-surface), 0.18);
  opacity: 1;
}

.settings-button {
  bottom: 20px;
  position: fixed;
  right: 20px;
  z-index: 10;
}
</style>
