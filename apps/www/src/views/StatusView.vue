<template>
  <div class="container">
    <draggable
      v-model="visibleTiles"
      class="inner-container"
      drag-class="machine--dragging"
      ghost-class="machine--ghost"
      item-key="id"
      @change="persistMachineOrder"
    >
      <template #item="{ element }">
        <div
          :class="[
            'machine',
            {
              'machine--blank': isBlankTile(element),
              'machine--blank-revealed': isBlankTile(element) && revealedBlankTileId === element.id,
            },
          ]"
          @pointercancel="handleBlankPressCancel()"
          @pointerdown="isBlankTile(element) ? handleBlankPressStart(element.id) : undefined"
          @pointerleave="handleBlankPressCancel()"
          @pointerup="handleBlankPressCancel()"
        >
          <MachineTile v-if="!isBlankTile(element)" :data="element" />
          <div v-else class="blank-tile">
            <button
              aria-label="Delete blank tile"
              class="blank-tile__delete"
              type="button"
              @click.stop="removeBlankTile(element.id)"
            >
              Delete
            </button>
          </div>
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
        <v-menu :close-on-content-click="false" location="start center">
          <template #activator="{ props }">
            <v-list-item
              v-bind="props"
              append-icon="mdi-menu-left"
              prepend-icon="mdi-domain-switch"
              title="Departments"
            />
          </template>

          <v-list density="compact" min-width="260">
            <v-list-subheader>Included Departments</v-list-subheader>
            <v-list-item v-if="departmentOptions.length" density="compact">
              <template #prepend>
                <v-checkbox-btn
                  :indeterminate="hasDepartmentFilter"
                  :model-value="areAllDepartmentsIncluded"
                  @update:model-value="toggleAllDepartments($event)"
                />
              </template>
              <v-list-item-title>All Departments</v-list-item-title>
            </v-list-item>
            <v-list-item
              v-for="department in departmentOptions"
              :key="department"
              density="compact"
            >
              <template #prepend>
                <v-checkbox-btn
                  :model-value="includedDepartmentKeys.includes(department)"
                  @update:model-value="toggleDepartment(department, $event)"
                />
              </template>
              <v-list-item-title>{{ department }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="!departmentOptions.length" density="compact">
              <v-list-item-title>No departments available</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import MachineTile from '@/components/MachineTile.vue';
import api, { statusApi } from '@/plugins/axios';
import { socket as appSocket } from '@/plugins/socket';

const MACHINE_ORDER_STORAGE_KEY = 'status-machine-order';
const INCLUDED_DEPARTMENTS_STORAGE_KEY = 'status-included-departments';
const BLANK_TILE_PREFIX = 'blank:';

type StatusTile = MachineInfo | BlankMachineTile;
type MachineDashboardMetadata = Pick<
  MachineJobDashboardRow,
  | 'jobId'
  | 'jobNumber'
  | 'partId'
  | 'partNumber'
  | 'partDescription'
  | 'partHasIncompleteData'
  | 'partSummary'
>;

const router = useRouter();
const tiles = ref<StatusTile[]>([]);
const resetOrderConfirmVisible = ref(false);
const includedDepartmentKeys = ref<string[]>(readIncludedDepartments());
const revealedBlankTileId = ref<string | null>(null);
let cachedMachineDashboardMetadata = new Map<string, MachineDashboardMetadata>();
let blankTilePressTimer: ReturnType<typeof setTimeout> | null = null;

const departmentOptions = computed(() => {
  return [
    ...new Set(
      tiles.value
        .filter((tile): tile is MachineInfo => !isBlankTile(tile))
        .map((machine) => machine.department?.trim() || '')
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
});

const hasDepartmentFilter = computed(() => {
  return (
    departmentOptions.value.length > 0 &&
    includedDepartmentKeys.value.length !== departmentOptions.value.length
  );
});

const areAllDepartmentsIncluded = computed(() => {
  return (
    departmentOptions.value.length > 0 &&
    includedDepartmentKeys.value.length === departmentOptions.value.length
  );
});

const visibleTiles = computed<StatusTile[]>({
  get() {
    if (!departmentOptions.value.length) return tiles.value;

    const includedDepartments = new Set(includedDepartmentKeys.value);
    return tiles.value.filter((tile) => {
      if (isBlankTile(tile)) return true;

      const department = tile.department?.trim() || '';
      return Boolean(department) && includedDepartments.has(department);
    });
  },
  set(reorderedVisibleTiles) {
    const visibleIds = new Set(reorderedVisibleTiles.map((tile) => tile.id));
    const nextVisibleTiles = [...reorderedVisibleTiles];

    tiles.value = tiles.value.map((tile) => {
      if (!visibleIds.has(tile.id)) return tile;
      const nextTile = nextVisibleTiles.shift();
      return nextTile ?? tile;
    });
  },
});

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
  appSocket.on('job', fetchMachines);
  appSocket.on('jobDeleted', fetchMachines);
  appSocket.on('part', fetchMachines);
  socket.connect();
});

onBeforeUnmount(() => {
  appSocket.off('job', fetchMachines);
  appSocket.off('jobDeleted', fetchMachines);
  appSocket.off('part', fetchMachines);
  socket.disconnect();
  clearBlankTilePressTimer();
});

async function fetchMachines() {
  Promise.all([statusApi.get<MachineInfo[]>('/machines'), fetchMachineDashboardMetadata()])
    .then(([{ data: machines }, machineDashboardMetadata]) => {
      tiles.value = orderMachines(
        machines.map((machine) => ({ ...machine, ...machineDashboardMetadata.get(machine.id) })),
      );
      syncIncludedDepartments();
      persistMachineOrder();
    })
    .catch((error) => {
      console.error('Error fetching status:', error);
    });
}

async function fetchMachineDashboardMetadata() {
  try {
    const { data } = await api.get<MachineJobDashboardResponse>('/jobs/machine-dashboard');

    cachedMachineDashboardMetadata = new Map<string, MachineDashboardMetadata>(
      data.active.map((machine) => [
        machine.machineId,
        {
          jobId: machine.jobId ?? null,
          jobNumber: machine.jobNumber ?? null,
          partId: machine.partId ?? null,
          partNumber: machine.partNumber ?? null,
          partDescription: machine.partDescription ?? null,
          partHasIncompleteData: machine.partHasIncompleteData ?? false,
          partSummary: machine.partSummary,
        },
      ]),
    );

    return cachedMachineDashboardMetadata;
  } catch (error) {
    console.warn('Unable to load machine dashboard metadata.', error);
    return cachedMachineDashboardMetadata;
  }
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

function readIncludedDepartments() {
  const storedValue = window.localStorage.getItem(INCLUDED_DEPARTMENTS_STORAGE_KEY);

  if (!storedValue) {
    return [] as string[];
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch (error) {
    console.warn('Unable to parse stored department filter.', error);
    return [] as string[];
  }
}

function persistMachineOrder() {
  window.localStorage.setItem(
    MACHINE_ORDER_STORAGE_KEY,
    JSON.stringify(tiles.value.map((tile) => tile.id)),
  );
}

function persistIncludedDepartments() {
  window.localStorage.setItem(
    INCLUDED_DEPARTMENTS_STORAGE_KEY,
    JSON.stringify(includedDepartmentKeys.value),
  );
}

function syncIncludedDepartments() {
  if (!departmentOptions.value.length) {
    includedDepartmentKeys.value = [];
    persistIncludedDepartments();
    return;
  }

  const nextIncluded = includedDepartmentKeys.value.filter((department) =>
    departmentOptions.value.includes(department),
  );
  includedDepartmentKeys.value = nextIncluded.length ? nextIncluded : [...departmentOptions.value];
  persistIncludedDepartments();
}

function toggleDepartment(department: string, included: boolean | null) {
  if (included) {
    includedDepartmentKeys.value = [...new Set([...includedDepartmentKeys.value, department])].sort(
      (left, right) => left.localeCompare(right),
    );
  } else {
    includedDepartmentKeys.value = includedDepartmentKeys.value.filter(
      (value) => value !== department,
    );
  }

  persistIncludedDepartments();
}

function toggleAllDepartments(included: boolean | null) {
  includedDepartmentKeys.value = included ? [...departmentOptions.value] : [];
  persistIncludedDepartments();
}

function addBlankTile() {
  tiles.value = [...tiles.value, createBlankTile()];
  persistMachineOrder();
}

function removeBlankTile(id: string) {
  tiles.value = tiles.value.filter((tile) => tile.id !== id);
  if (revealedBlankTileId.value === id) {
    revealedBlankTileId.value = null;
  }
  persistMachineOrder();
}

function handleBlankPressStart(id: string) {
  clearBlankTilePressTimer();
  blankTilePressTimer = setTimeout(() => {
    revealedBlankTileId.value = id;
    blankTilePressTimer = null;
  }, 450);
}

function handleBlankPressCancel() {
  clearBlankTilePressTimer();
}

function clearBlankTilePressTimer() {
  if (!blankTilePressTimer) return;
  clearTimeout(blankTilePressTimer);
  blankTilePressTimer = null;
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
  height: 78px;
  min-width: 280px;
  max-width: 400px;
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
  gap: 10px;
  justify-content: center;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
  width: 100%;
}

.machine--blank-revealed .blank-tile {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
  border-color: rgba(var(--v-theme-error), 0.4);
  opacity: 1;
}

.blank-tile__label {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.blank-tile__delete {
  border: 0;
  border-radius: 999px;
  background: rgba(var(--v-theme-error), 0.12);
  color: rgb(var(--v-theme-error));
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0;
  padding: 4px 10px;
  pointer-events: none;
  visibility: hidden;
  transition:
    opacity 0.15s ease,
    visibility 0s linear 0.15s,
    background-color 0.15s ease;
  transition-delay: 0s;
}

.blank-tile__delete:hover {
  background: rgba(var(--v-theme-error), 0.18);
}

.machine--blank:hover .blank-tile,
.machine--blank:focus-within .blank-tile {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-on-surface), 0.18);
  opacity: 1;
}

.machine--blank:hover .blank-tile__delete,
.machine--blank:focus-within .blank-tile__delete,
.machine--blank-revealed .blank-tile__delete {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.machine--blank:hover .blank-tile__delete,
.machine--blank:focus-within .blank-tile__delete {
  transition-delay: 3s, 3s, 3s;
}

.machine--blank-revealed .blank-tile__delete {
  transition-delay: 0s, 0s, 0s;
}

.settings-button {
  bottom: 20px;
  position: fixed;
  right: 20px;
  z-index: 10;
}
</style>
