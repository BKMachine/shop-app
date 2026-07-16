<template>
  <div v-if="loading" class="d-flex justify-center align-center job-loading">
    <v-progress-circular color="primary" indeterminate size="120" />
  </div>

  <v-container v-else class="job-container">
    <div class="job-header-grid py-4">
      <div class="job-header-grid__left">
        <h1 class="job-header-grid__title">{{ pageTitle }}</h1>
      </div>

      <div class="job-header-grid__center">
        <div class="job-header-grid__part-title">{{ partHeaderTitle }}</div>
        <div class="job-header-grid__part-subtitle">{{ partHeaderSubtitle }}</div>
      </div>

      <div class="job-header-grid__right">
        <div class="job-header-grid__chips">
          <div class="job-header-grid__chip-row">
            <v-chip :color="statusColor(draft.status)" density="comfortable">
              {{ statusLabel(draft.status) }}
            </v-chip>
            <v-chip :color="priorityColor(draft.priority)" density="comfortable" variant="tonal">
              {{ priorityLabel }}
              Priority
            </v-chip>
          </div>
          <div class="job-header-grid__chip-row">
            <v-chip density="comfortable" variant="outlined"> Qty {{ normalizedQty }} </v-chip>
            <v-chip v-if="draft.dueDate" density="comfortable" variant="outlined">
              Due {{ formatHeaderDate(draft.dueDate) }}
            </v-chip>
          </div>
        </div>
      </div>
    </div>

    <v-tabs v-model="tab" bg-color="#555555" class="mb-4" color="yellow">
      <v-tab value="general"> General </v-tab>
      <v-tab value="production"> Production </v-tab>
      <v-tab value="shipments"> Shipments </v-tab>
      <v-spacer />
      <div class="job-header__actions px-2">
        <v-btn v-if="showDelete" color="error" variant="text" @click="deleteConfirm = true">
          Delete
        </v-btn>
        <v-btn
          v-if="!isCreateRoute"
          :loading="travelerLoading"
          prepend-icon="mdi-printer-outline"
          variant="text"
          @click="printJobTraveler"
        >
          Traveler
        </v-btn>
        <v-btn color="green" :disabled="!canSaveJob" :loading="saving" @click="saveJob">
          {{ isCreateRoute ? 'Create' : 'Save' }}
        </v-btn>
      </div>
    </v-tabs>

    <v-card>
      <v-window v-model="tab">
        <v-window-item value="general">
          <v-card-text>
            <v-form v-model="valid"> <JobFormFields v-model="draft" /> </v-form>
          </v-card-text>
        </v-window-item>

        <v-window-item value="production">
          <v-card-text>
            <div class="production-tab">
              <div class="production-tab__header">
                <div>
                  <div class="text-h6">Production Tasks</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Start work on a machine, then end each task when that machine run is complete.
                  </div>
                </div>

                <v-btn
                  class="production-tab__start-button"
                  color="success"
                  :disabled="!canOpenStartTaskDialog"
                  :loading="productionTaskLoading"
                  prepend-icon="mdi-play"
                  size="x-large"
                  @click="openStartTaskDialog"
                >
                  Start Task
                </v-btn>
              </div>

              <div
                v-if="showCreateRouteProductionMessage"
                class="production-tab__empty text-medium-emphasis"
              >
                Save the job before starting production tasks.
              </div>

              <template v-else>
                <div v-if="machinesLoading" class="text-body-2 text-medium-emphasis">
                  Loading machines...
                </div>

                <div v-if="machinesLoadFailed" class="text-body-2 text-error">
                  Unable to load machines. Check the status API connection and try again.
                </div>

                <div
                  v-if="!productionTasks.length"
                  class="production-tab__empty text-medium-emphasis"
                >
                  No production tasks yet.
                </div>

                <div v-else class="production-tab__list">
                  <v-card
                    v-for="(task, index) in productionTasks"
                    :key="task.id"
                    class="production-entry"
                    variant="outlined"
                  >
                    <v-card-text>
                      <div class="production-entry__header mb-4">
                        <div>
                          <div class="text-subtitle-1 font-weight-medium">Task {{ index + 1 }}</div>
                          <div class="text-body-2 text-medium-emphasis">
                            {{ task.machineName }}
                            • {{ machineTypeLabel(task.machineType) }}
                          </div>
                        </div>
                        <v-chip
                          :color="task.endedAt ? 'grey' : 'success'"
                          size="small"
                          variant="tonal"
                        >
                          {{ task.endedAt ? 'Ended' : 'Active' }}
                        </v-chip>
                      </div>

                      <div class="production-entry__grid">
                        <div>
                          <div class="production-entry__label">Machine</div>
                          <div class="production-entry__value">{{ task.machineName }}</div>
                        </div>
                        <div>
                          <div class="production-entry__label">Started</div>
                          <div class="production-entry__value">
                            {{ formatTaskDateTime(task.startedAt) }}
                          </div>
                        </div>
                        <div>
                          <div class="production-entry__label">Ended</div>
                          <div class="production-entry__value">
                            {{ task.endedAt ? formatTaskDateTime(task.endedAt) : 'In progress' }}
                          </div>
                        </div>
                        <div>
                          <div class="production-entry__label">Duration</div>
                          <div class="production-entry__value">{{ formatTaskDuration(task) }}</div>
                        </div>
                        <div class="production-entry__action">
                          <v-btn
                            v-if="!task.endedAt"
                            color="primary"
                            :disabled="productionTaskLoading"
                            variant="flat"
                            @click="requestEndProductionTask(task.id)"
                          >
                            End Task
                          </v-btn>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
              </template>
            </div>
          </v-card-text>
        </v-window-item>

        <v-window-item value="shipments">
          <v-card-text>
            <div class="shipments-placeholder">
              <div class="text-h6">Shipments</div>
              <div class="text-body-1 text-medium-emphasis mt-2">
                Shipment history and related shipment actions will live here.
              </div>
            </div>
          </v-card-text>
        </v-window-item>
      </v-window>
    </v-card>

    <v-dialog v-model="deleteConfirm" max-width="420">
      <v-card>
        <v-card-title>Delete Job?</v-card-title>
        <v-card-text>
          This will permanently remove
          <strong v-if="job">job #{{ job.jobNumber }}</strong>
          <span v-else>this job</span>.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteConfirm = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteJob">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="startTaskDialog" max-width="720">
      <v-card>
        <v-card-title>Start Task</v-card-title>
        <v-card-text>
          <div v-if="job">Choose the machine to start for Job #{{ job.jobNumber }}.</div>
          <div v-if="jobSummaryDetails" class="production-dialog__details mt-3">
            {{ jobSummaryDetails }}
          </div>
          <div v-if="draftIsAltered" class="text-medium-emphasis mt-3">
            Unsaved changes on this page will be discarded.
          </div>

          <v-row class="mt-2">
            <v-col cols="12" md="4">
              <v-select
                clearable
                hide-details
                item-title="displayName"
                item-value="id"
                :items="machineOptionsByType.mill"
                label="Mill"
                :model-value="selectedStartTaskMachineIds.mill"
                @update:model-value="updateStartTaskMachineSelection('mill', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                clearable
                hide-details
                item-title="displayName"
                item-value="id"
                :items="machineOptionsByType.lathe"
                label="Lathe"
                :model-value="selectedStartTaskMachineIds.lathe"
                @update:model-value="updateStartTaskMachineSelection('lathe', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                clearable
                hide-details
                item-title="displayName"
                item-value="id"
                :items="machineOptionsByType.swiss"
                label="Swiss"
                :model-value="selectedStartTaskMachineIds.swiss"
                @update:model-value="updateStartTaskMachineSelection('swiss', $event)"
              />
            </v-col>
          </v-row>

          <div v-if="selectedStartTaskMachine" class="text-body-2 mt-4">
            Selected machine: {{ selectedStartTaskMachine.displayName }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeStartTaskDialog">Cancel</v-btn>
          <v-btn
            color="success"
            :disabled="!canConfirmStartTask"
            :loading="productionTaskLoading"
            @click="confirmStartTask"
          >
            Start Task
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog max-width="420" :model-value="Boolean(endTaskConfirmTaskId)">
      <v-card>
        <v-card-title>End Task</v-card-title>
        <v-card-text>
          <div>Are you sure you want to end this task?</div>
          <div v-if="pendingEndTask" class="production-dialog__details mt-3">
            {{ pendingEndTask.machineName }}: {{ machineTypeLabel(pendingEndTask.machineType) }}
          </div>
          <div v-if="jobSummaryDetails" class="text-medium-emphasis mt-2">
            {{ jobSummaryDetails }}
          </div>
          <div v-if="draftIsAltered" class="text-medium-emphasis mt-3">
            Unsaved changes on this page will be discarded.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="endTaskConfirmTaskId = null">Cancel</v-btn>
          <v-btn color="primary" :loading="productionTaskLoading" @click="confirmEndProductionTask">
            End Task
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import JobFormFields, { type JobDraft } from '@/components/jobs/JobFormFields.vue';
import { statusApi } from '@/plugins/axios';
import printer from '@/plugins/printer';
import { toastError } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { isAdmin } from '@/state/device';
import { useJobsStore } from '@/stores/jobs_store';

const route = useRoute();
const jobsStore = useJobsStore();

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const travelerLoading = ref(false);
const deleteConfirm = ref(false);
const machines = ref<MachineInfo[]>([]);
const machinesLoading = ref(false);
const machinesLoadFailed = ref(false);
const productionTaskLoading = ref(false);
const startTaskDialog = ref(false);
const endTaskConfirmTaskId = ref<string | null>(null);
const job = ref<Job | null>(null);
const draft = ref(createEmptyDraft());
const tab = ref<'general' | 'production' | 'shipments'>('general');
const valid = ref(false);
const selectedStartTaskMachineIds = ref<Record<MachineType, string | null>>({
  mill: null,
  lathe: null,
  swiss: null,
});

const isCreateRoute = computed(() => route.name === 'createJob');
const showDelete = computed(() => !isCreateRoute.value && Boolean(job.value) && isAdmin.value);
const pageTitle = computed(() =>
  isCreateRoute.value ? 'New Job' : `Job #${job.value?.jobNumber ?? ''}`,
);
const pageSubtitle = computed(() => {
  if (isCreateRoute.value) return 'Create a new job record';
  if (!job.value) return 'Job details';

  const customerName =
    job.value.customerName ||
    (typeof job.value.customer === 'string' ? '' : job.value.customer?.name || '');
  const partNumber =
    job.value.partNumber || (typeof job.value.part === 'string' ? '' : job.value.part?.part || '');
  const partDescription =
    job.value.partDescription ||
    (typeof job.value.part === 'string' ? '' : job.value.part?.description || '');

  return [customerName, [partNumber, partDescription].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(' | ');
});
const partHeaderTitle = computed(() => {
  if (isCreateRoute.value) return 'Select part details';
  if (!job.value) return 'Part details';

  const partNumber =
    job.value.partNumber || (typeof job.value.part === 'string' ? '' : job.value.part?.part || '');
  const partDescription =
    job.value.partDescription ||
    (typeof job.value.part === 'string' ? '' : job.value.part?.description || '');

  return [partNumber, partDescription].filter(Boolean).join(' - ') || 'Part details';
});
const partHeaderSubtitle = computed(() => {
  if (isCreateRoute.value) return 'Customer and part selection live in the General tab';
  if (!job.value) return 'Job details';

  const customerName =
    job.value.customerName ||
    (typeof job.value.customer === 'string' ? '' : job.value.customer?.name || '');

  return customerName || pageSubtitle.value || 'Job details';
});
const priorityLabel = computed(() => {
  if (draft.value.priority === 'rush') return 'Rush';
  if (draft.value.priority === 'low') return 'Low';
  return 'Normal';
});
const normalizedQty = computed(() => Math.max(1, Number(draft.value.qty) || 1));
const draftIsAltered = computed(() => {
  const baselineDraft = isCreateRoute.value
    ? createEmptyDraft()
    : job.value
      ? jobToDraft(job.value)
      : null;
  if (!baselineDraft) return false;
  return serializeDraft(draft.value) !== serializeDraft(baselineDraft);
});
const canSaveJob = computed(() => draftIsAltered.value && valid.value);
const productionTasks = computed(() => job.value?.productionTasks ?? []);
const jobSummaryDetails = computed(() => {
  if (!job.value) return '';

  const customerName =
    job.value.customerName ||
    (typeof job.value.customer === 'string' ? '' : job.value.customer?.name || '');
  const partTitle = partHeaderTitle.value;

  return [customerName, partTitle].filter(Boolean).join(': ');
});
const sortedMachines = computed(() =>
  [...machines.value].sort((left, right) =>
    (left.displayName || left.name).localeCompare(right.displayName || right.name),
  ),
);
const machineOptionsByType = computed<Record<MachineType, MachineInfo[]>>(() => ({
  mill: sortedMachines.value.filter((machine) => machine.type === 'mill'),
  lathe: sortedMachines.value.filter((machine) => machine.type === 'lathe'),
  swiss: sortedMachines.value.filter((machine) => machine.type === 'swiss'),
}));
const selectedStartTaskMachine = computed(() => {
  const selectedMachineIds = Object.values(selectedStartTaskMachineIds.value).filter(Boolean);
  return sortedMachines.value.find((machine) => selectedMachineIds.includes(machine.id)) || null;
});
const pendingEndTask = computed(
  () => productionTasks.value.find((task) => task.id === endTaskConfirmTaskId.value) || null,
);
const showCreateRouteProductionMessage = computed(() => isCreateRoute.value || !job.value);
const canOpenStartTaskDialog = computed(
  () =>
    !showCreateRouteProductionMessage.value &&
    !machinesLoading.value &&
    !machinesLoadFailed.value &&
    !productionTaskLoading.value &&
    machines.value.length > 0 &&
    job.value?.status !== 'closed',
);
const canConfirmStartTask = computed(
  () => canOpenStartTaskDialog.value && Boolean(selectedStartTaskMachine.value),
);

watch(
  () => route.fullPath,
  () => {
    void syncRouteState();
  },
);

onMounted(async () => {
  await syncRouteState();
  await fetchMachines();
});

function createEmptyDraft(): JobDraft {
  return {
    customer: null,
    part: null,
    qty: '1',
    status: 'open',
    dueDate: defaultDueDateValue(),
    startedOn: '',
    completedOn: '',
    customerPo: '',
    priority: 'normal',
    notes: '',
  };
}

function defaultDueDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toLocaleDateString('en-CA');
}

function currentDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentTimestampValue() {
  return new Date().toISOString();
}

function serializeDraft(value: JobDraft) {
  return JSON.stringify({
    customer: value.customer || null,
    part: value.part || null,
    qty: Math.max(1, Number(value.qty) || 1),
    status: value.status,
    dueDate: value.dueDate || '',
    startedOn: value.startedOn || '',
    completedOn: value.completedOn || '',
    customerPo: value.customerPo.trim(),
    priority: value.priority,
    notes: value.notes.trim(),
  });
}

function dateInputValue(value: string | Date | null | undefined) {
  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function jobToDraft(currentJob: Job): JobDraft {
  return {
    customer:
      typeof currentJob.customer === 'string'
        ? currentJob.customer
        : currentJob.customer?._id || null,
    part: typeof currentJob.part === 'string' ? currentJob.part : currentJob.part?._id || null,
    qty: String(Math.max(1, Number(currentJob.qty) || 1)),
    status: currentJob.status,
    dueDate: dateInputValue(currentJob.dueDate),
    startedOn: dateInputValue(currentJob.startedOn),
    completedOn: dateInputValue(currentJob.completedOn),
    customerPo: currentJob.customerPo || '',
    priority: currentJob.priority || 'normal',
    notes: currentJob.notes || '',
  };
}

function validateDraft(nextDraft: JobDraft, existingProductionTasks: JobProductionTask[]) {
  if (!nextDraft.customer) return 'Select a customer.';
  if (!nextDraft.part) return 'Select a part.';
  if (Math.max(0, Number(nextDraft.qty) || 0) < 1) return 'Qty must be at least 1.';
  if (
    nextDraft.status === 'closed' &&
    existingProductionTasks.some((productionTask) => !productionTask.endedAt)
  ) {
    return 'All production tasks must be ended before closing the job.';
  }
  return null;
}

function toJobPayload(nextDraft: JobDraft, productionTasks: JobProductionTask[] = []): JobCreate {
  return {
    customer: nextDraft.customer || '',
    part: nextDraft.part || '',
    qty: Math.max(1, Number(nextDraft.qty) || 1),
    status: nextDraft.status,
    dueDate: nextDraft.dueDate || undefined,
    startedOn: nextDraft.startedOn || undefined,
    completedOn: nextDraft.status === 'closed' ? nextDraft.completedOn || undefined : undefined,
    customerPo: nextDraft.customerPo.trim() || undefined,
    priority: nextDraft.priority,
    notes: nextDraft.notes.trim() || undefined,
    productionTasks,
  };
}

function applyJobStatus(nextDraft: JobDraft, status: JobStatus): JobDraft {
  const updatedDraft: JobDraft = {
    ...nextDraft,
    status,
  };

  if (status === 'in_process' && !updatedDraft.startedOn) {
    updatedDraft.startedOn = currentDateInputValue();
  }

  if (status === 'closed' && !updatedDraft.completedOn) {
    updatedDraft.completedOn = currentDateInputValue();
  }

  if (status !== 'closed') {
    updatedDraft.completedOn = '';
  }

  return updatedDraft;
}

async function syncRouteState() {
  tab.value = 'general';
  closeStartTaskDialog();
  endTaskConfirmTaskId.value = null;

  if (isCreateRoute.value) {
    job.value = null;
    draft.value = createEmptyDraft();
    loading.value = false;
    return;
  }

  const id = typeof route.params.id === 'string' ? route.params.id : '';
  if (!id) {
    await router.replace({ name: 'jobs' });
    return;
  }

  loading.value = true;
  try {
    const loadedJob = await jobsStore.findById(id);
    job.value = loadedJob;
    draft.value = jobToDraft(loadedJob);
  } catch {
    await router.replace({ name: 'jobs' });
  } finally {
    loading.value = false;
  }
}

async function fetchMachines() {
  machinesLoading.value = true;
  machinesLoadFailed.value = false;

  try {
    const { data } = await statusApi.get<MachineInfo[]>('/machines');
    machines.value = data;
  } catch {
    machines.value = [];
    machinesLoadFailed.value = true;
    toastError('Unable to load machines.');
  } finally {
    machinesLoading.value = false;
  }
}

async function saveJob() {
  if (!canSaveJob.value) return;

  const errorMessage = validateDraft(draft.value, job.value?.productionTasks ?? []);
  if (errorMessage) {
    toastError(errorMessage);
    return;
  }

  saving.value = true;
  try {
    const payload = toJobPayload(draft.value, job.value?.productionTasks ?? []);

    if (isCreateRoute.value) {
      const createdJob = await jobsStore.create(payload);
      job.value = createdJob;
      draft.value = jobToDraft(createdJob);
      await router.replace({ name: 'viewJob', params: { id: createdJob._id } });
      return;
    }

    if (!job.value) return;
    const updatedJob = await jobsStore.update({
      ...payload,
      _id: job.value._id,
      jobNumber: job.value.jobNumber,
    });
    job.value = updatedJob;
    draft.value = jobToDraft(updatedJob);
  } finally {
    saving.value = false;
  }
}

function resetStartTaskMachineSelection() {
  selectedStartTaskMachineIds.value = {
    mill: null,
    lathe: null,
    swiss: null,
  };
}

function updateStartTaskMachineSelection(machineType: MachineType, value: string | null) {
  const nextSelection: Record<MachineType, string | null> = {
    mill: null,
    lathe: null,
    swiss: null,
  };

  nextSelection[machineType] = value;
  selectedStartTaskMachineIds.value = nextSelection;
}

function openStartTaskDialog() {
  if (!canOpenStartTaskDialog.value) return;

  resetStartTaskMachineSelection();
  startTaskDialog.value = true;
}

function closeStartTaskDialog() {
  startTaskDialog.value = false;
  resetStartTaskMachineSelection();
}

async function confirmStartTask() {
  if (!job.value || !selectedStartTaskMachine.value) return;

  const nextTasks = [
    ...productionTasks.value,
    {
      id: crypto.randomUUID(),
      machineId: selectedStartTaskMachine.value.id,
      machineName:
        selectedStartTaskMachine.value.displayName || selectedStartTaskMachine.value.name,
      machineType: selectedStartTaskMachine.value.type,
      startedAt: currentTimestampValue(),
      endedAt: null,
    },
  ];
  const nextDraft = applyJobStatus(jobToDraft(job.value), 'in_process');

  productionTaskLoading.value = true;
  try {
    const updatedJob = await jobsStore.update({
      ...toJobPayload(nextDraft, nextTasks),
      _id: job.value._id,
      jobNumber: job.value.jobNumber,
    });
    job.value = updatedJob;
    draft.value = jobToDraft(updatedJob);
    closeStartTaskDialog();
  } finally {
    productionTaskLoading.value = false;
  }
}

function requestEndProductionTask(taskId: string) {
  const task = productionTasks.value.find((currentTask) => currentTask.id === taskId);
  if (!task || task.endedAt || productionTaskLoading.value) return;

  endTaskConfirmTaskId.value = taskId;
}

async function confirmEndProductionTask() {
  if (!job.value || !pendingEndTask.value) return;

  const nextTasks = productionTasks.value.map((task) =>
    task.id === pendingEndTask.value?.id ? { ...task, endedAt: currentTimestampValue() } : task,
  );

  productionTaskLoading.value = true;
  try {
    const updatedJob = await jobsStore.update({
      ...toJobPayload(jobToDraft(job.value), nextTasks),
      _id: job.value._id,
      jobNumber: job.value.jobNumber,
    });
    job.value = updatedJob;
    draft.value = jobToDraft(updatedJob);
    endTaskConfirmTaskId.value = null;
  } finally {
    productionTaskLoading.value = false;
  }
}

async function deleteJob() {
  if (!job.value) return;

  deleting.value = true;
  try {
    await jobsStore.remove(job.value._id);
    deleteConfirm.value = false;
    await router.push({ name: 'jobs' });
  } finally {
    deleting.value = false;
  }
}

async function printJobTraveler() {
  if (!job.value?._id) return;

  travelerLoading.value = true;
  try {
    await printer.openJobTraveler(job.value._id);
  } finally {
    travelerLoading.value = false;
  }
}

function priorityColor(priority: JobPriority | undefined) {
  if (priority === 'rush') return 'error';
  if (priority === 'low') return 'grey';
  return 'primary';
}

function statusColor(status: JobStatus) {
  if (status === 'closed') return 'grey';
  if (status === 'in_process') return 'warning';
  return 'success';
}

function statusLabel(status: JobStatus) {
  if (status === 'in_process') return 'In Process';
  if (status === 'closed') return 'Closed';
  return 'Open';
}

function formatHeaderDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTaskDateTime(value: string | Date | null | undefined) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function formatTaskDuration(task: JobProductionTask) {
  if (!task.endedAt) return 'In progress';

  const startedAt = new Date(task.startedAt);
  const endedAt = new Date(task.endedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) return '';

  const totalMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function machineTypeLabel(machineType: MachineType) {
  if (machineType === 'mill') return 'Mill';
  if (machineType === 'lathe') return 'Lathe';
  return 'Swiss';
}
</script>

<style scoped>
.job-loading {
  min-height: calc(100vh - 88px);
}

.job-container {
  padding-top: 24px;
  padding-bottom: 32px;
}

.job-header-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
}

.job-header-grid__left {
  min-width: 0;
}

.job-header-grid__center {
  min-width: 0;
  text-align: center;
}

.job-header-grid__right {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: flex-end;
}

.job-header-grid__chips {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
}

.job-header-grid__chip-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
}

.job-header-grid__title {
  margin: 0;
}

.job-header-grid__part-title {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.2;
}

.job-header-grid__part-subtitle {
  margin-top: 4px;
  font-size: 1rem;
  color: rgba(0, 0, 0, 0.6);
}

.job-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.production-dialog__details {
  font-weight: 600;
}

.production-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.production-tab__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.production-tab__start-button {
  min-height: 52px;
  font-weight: 700;
}

.production-tab__empty {
  border: 1px dashed rgba(0, 0, 0, 0.18);
  border-radius: 12px;
  padding: 24px;
}

.production-tab__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.production-entry__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.production-entry__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 16px;
  align-items: end;
}

.production-entry__label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.55);
}

.production-entry__value {
  margin-top: 6px;
  font-weight: 600;
}

.production-entry__action {
  display: flex;
  align-items: end;
  justify-content: flex-end;
}

.shipments-placeholder {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

@media (max-width: 960px) {
  .job-header-grid {
    grid-template-columns: 1fr;
  }

  .job-header-grid__left,
  .job-header-grid__center,
  .job-header-grid__right {
    justify-content: center;
    text-align: center;
  }

  .job-header-grid__right,
  .job-header-grid__chip-row {
    align-items: center;
    justify-content: center;
  }

  .job-header-grid__right {
    flex-direction: column;
  }
  .production-tab__header,
  .production-entry__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .production-entry__grid {
    grid-template-columns: 1fr;
  }

  .production-entry__action {
    justify-content: flex-start;
  }
}
</style>
