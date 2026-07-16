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
                  <div class="text-h6">Production Entries</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Frontend-only for now. Entries stay local to this page until backend support is
                    added.
                  </div>
                </div>

                <v-btn color="primary" prepend-icon="mdi-plus" @click="addProductionEntry">
                  Add Entry
                </v-btn>
              </div>

              <div
                v-if="!productionEntries.length"
                class="production-tab__empty text-medium-emphasis"
              >
                No production entries yet.
              </div>

              <div v-else class="production-tab__list">
                <v-card
                  v-for="(entry, index) in productionEntries"
                  :key="entry.id"
                  class="production-entry"
                  variant="outlined"
                >
                  <v-card-text>
                    <div class="production-entry__header mb-4">
                      <div class="text-subtitle-1 font-weight-medium">Entry {{ index + 1 }}</div>
                      <v-btn
                        color="error"
                        size="small"
                        variant="text"
                        @click="removeProductionEntry(entry.id)"
                      >
                        Remove
                      </v-btn>
                    </div>

                    <v-row>
                      <v-col cols="12" md="3">
                        <v-text-field
                          v-model="entry.name"
                          label="Name"
                          placeholder="Operator name"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col cols="12" md="3">
                        <v-text-field
                          v-model="entry.machine"
                          label="Machine"
                          placeholder="Machine"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col cols="12" md="3">
                        <v-text-field
                          v-model="entry.startTime"
                          label="Start Time"
                          type="datetime-local"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col cols="12" md="3">
                        <v-text-field
                          v-model="entry.endTime"
                          label="End Time"
                          type="datetime-local"
                          variant="outlined"
                        />
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </div>
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
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import JobFormFields, { type JobDraft } from '@/components/jobs/JobFormFields.vue';
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
const job = ref<Job | null>(null);
const draft = ref(createEmptyDraft());
const tab = ref<'general' | 'production' | 'shipments'>('general');
const valid = ref(false);
const productionEntries = ref<ProductionEntry[]>([]);

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

watch(
  () => route.fullPath,
  () => {
    void syncRouteState();
  },
);

onMounted(async () => {
  await syncRouteState();
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

type ProductionEntry = {
  id: string;
  name: string;
  machine: string;
  startTime: string;
  endTime: string;
};

function createProductionEntry(): ProductionEntry {
  return {
    id: crypto.randomUUID(),
    name: '',
    machine: '',
    startTime: '',
    endTime: '',
  };
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

function validateDraft(nextDraft: JobDraft) {
  if (!nextDraft.customer) return 'Select a customer.';
  if (!nextDraft.part) return 'Select a part.';
  if (Math.max(0, Number(nextDraft.qty) || 0) < 1) return 'Qty must be at least 1.';
  return null;
}

function toJobPayload(nextDraft: JobDraft): JobCreate {
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
  };
}

async function syncRouteState() {
  tab.value = 'general';
  productionEntries.value = [];

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

function addProductionEntry() {
  productionEntries.value = [...productionEntries.value, createProductionEntry()];
}

function removeProductionEntry(entryId: string) {
  productionEntries.value = productionEntries.value.filter((entry) => entry.id !== entryId);
}

async function saveJob() {
  if (!canSaveJob.value) return;

  const errorMessage = validateDraft(draft.value);
  if (errorMessage) {
    toastError(errorMessage);
    return;
  }

  saving.value = true;
  try {
    if (isCreateRoute.value) {
      const createdJob = await jobsStore.create(toJobPayload(draft.value));
      job.value = createdJob;
      draft.value = jobToDraft(createdJob);
      await router.replace({ name: 'viewJob', params: { id: createdJob._id } });
      return;
    }

    if (!job.value) return;
    const updatedJob = await jobsStore.update({
      ...toJobPayload(draft.value),
      _id: job.value._id,
      jobNumber: job.value.jobNumber,
    });
    job.value = updatedJob;
    draft.value = jobToDraft(updatedJob);
  } finally {
    saving.value = false;
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

function goBack() {
  void router.push({ name: 'jobs' });
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
  align-items: flex-end;
  flex-direction: column;
  gap: 12px;
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

  .production-tab__header,
  .production-entry__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
