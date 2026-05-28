<template>
  <v-container class="status-settings">
    <v-card class="mb-4" rounded="lg">
      <v-card-title class="status-settings__header">
        <div>
          <div class="text-h5">Machine Settings</div>
          <div class="text-body-2 text-medium-emphasis">
            Add new machines or update existing machine definitions for the status board.
          </div>
        </div>

        <div class="status-settings__header-actions">
          <v-btn prepend-icon="mdi-arrow-left" variant="text" @click="router.push({ name: 'status' })">
            Back to Status
          </v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" variant="flat" @click="startCreate">
            Add Machine
          </v-btn>
        </div>
      </v-card-title>
    </v-card>

    <v-row>
      <v-col cols="12" md="4">
        <v-card rounded="lg">
          <v-card-title>Machines</v-card-title>
          <v-card-text>
            <v-list v-if="machines.length" class="status-settings__machine-list" lines="two">
              <v-list-item
                v-for="machine in machines"
                :key="machine.id"
                :active="machine.id === selectedMachineId"
                rounded="lg"
                @click="selectMachine(machine)"
              >
                <v-list-item-title>{{ machine.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ machine.brand }} • {{ machine.type }} • {{ machine.location }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <div v-else class="text-body-2 text-medium-emphasis">No machines found.</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card rounded="lg">
          <v-card-title>
            {{ selectedMachineId ? 'Edit Machine' : 'Add Machine' }}
          </v-card-title>
          <v-card-text>
            <v-form @submit.prevent="saveMachine">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field v-model="form.name" label="Name" required variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.serialNumber"
                    label="Serial Number"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.brand"
                    :items="brandOptions"
                    label="Brand"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field v-model="form.model" label="Model" required variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.type"
                    :items="typeOptions"
                    label="Type"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.source"
                    :items="sourceOptions"
                    label="Source"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.paths"
                    :items="pathOptions"
                    label="Paths"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="form.location"
                    label="Location"
                    required
                    variant="outlined"
                  />
                </v-col>
              </v-row>

              <div class="status-settings__form-actions">
                <v-btn variant="text" @click="resetForm">Reset</v-btn>
                <v-btn
                  color="primary"
                  :disabled="!canSave"
                  :loading="savePending"
                  type="submit"
                  variant="flat"
                >
                  {{ selectedMachineId ? 'Save Changes' : 'Create Machine' }}
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { statusApi } from '@/plugins/axios';

type MachineForm = {
  name: string;
  serialNumber: string;
  brand: MachineBrand | '';
  model: string;
  source: MachineSource | '';
  type: MachineType | '';
  paths: '1' | '2';
  location: string;
};

const brandOptions: MachineBrand[] = ['fanuc', 'mori', 'doosan', 'mitsubishi', 'haas', 'mazak', 'hanwha'];
const sourceOptions: MachineSource[] = ['focas', 'arduino', 'mtconnect', 'serial'];
const typeOptions: MachineType[] = ['lathe', 'mill', 'swiss'];
const pathOptions: Array<'1' | '2'> = ['1', '2'];

const router = useRouter();
const machines = ref<MachineInfo[]>([]);
const selectedMachineId = ref<string | null>(null);
const savePending = ref(false);
const form = ref<MachineForm>(createEmptyForm());

const canSave = computed(() =>
  Boolean(
    form.value.name.trim() &&
      form.value.serialNumber.trim() &&
      form.value.brand &&
      form.value.model.trim() &&
      form.value.source &&
      form.value.type &&
      form.value.paths &&
      form.value.location.trim(),
  ),
);

onMounted(async () => {
  await fetchMachines();
});

async function fetchMachines() {
  try {
    const { data } = await statusApi.get<MachineInfo[]>('/machines');
    machines.value = [...data].sort((a, b) => a.name.localeCompare(b.name));

    if (selectedMachineId.value) {
      const selected = machines.value.find((machine) => machine.id === selectedMachineId.value);
      if (selected) {
        applyMachineToForm(selected);
      } else {
        resetForm();
      }
    }
  } catch (error) {
    console.error('Error fetching machines:', error);
    toastError('Unable to load machines.');
  }
}

function selectMachine(machine: MachineInfo) {
  selectedMachineId.value = machine.id;
  applyMachineToForm(machine);
}

function startCreate() {
  resetForm();
}

function resetForm() {
  selectedMachineId.value = null;
  form.value = createEmptyForm();
}

function applyMachineToForm(machine: MachineInfo) {
  form.value = {
    name: machine.name,
    serialNumber: machine.serialNumber,
    brand: machine.brand,
    model: machine.model,
    source: machine.source,
    type: machine.type,
    paths: machine.paths,
    location: machine.location,
  };
}

async function saveMachine() {
  if (!canSave.value) {
    toastError('Fill out all machine fields before saving.');
    return;
  }

  savePending.value = true;

  try {
    const payload = {
      name: form.value.name.trim(),
      serialNumber: form.value.serialNumber.trim(),
      brand: form.value.brand,
      model: form.value.model.trim(),
      source: form.value.source,
      type: form.value.type,
      paths: form.value.paths,
      location: form.value.location.trim(),
    };

    if (selectedMachineId.value) {
      await statusApi.put(`/machine/${selectedMachineId.value}`, payload);
      toastSuccess('Machine updated successfully');
    } else {
      await statusApi.post('/machine', payload);
      toastSuccess('Machine added successfully');
    }

    const targetLocation = payload.location;
    await fetchMachines();
    const matchingMachine = machines.value.find((machine) => machine.location === targetLocation);

    if (matchingMachine) {
      selectMachine(matchingMachine);
    } else {
      resetForm();
    }
  } catch (error) {
    console.error('Error saving machine:', error);
    toastError(selectedMachineId.value ? 'Failed to update machine' : 'Failed to add machine');
  } finally {
    savePending.value = false;
  }
}

function createEmptyForm(): MachineForm {
  return {
    name: '',
    serialNumber: '',
    brand: '',
    model: '',
    source: '',
    type: '',
    paths: '1',
    location: '',
  };
}
</script>

<style scoped>
.status-settings {
  padding-block: 16px 32px;
}

.status-settings__header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  white-space: normal;
}

.status-settings__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.status-settings__machine-list {
  padding: 0;
}

.status-settings__form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .status-settings__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .status-settings__form-actions {
    justify-content: stretch;
  }
}
</style>