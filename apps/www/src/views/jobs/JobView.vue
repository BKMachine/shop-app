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
            <MaterialSwatch :on-hand="draft.materialOnHandOn" :ordered="draft.materialOrderedOn" />
          </div>
          <div class="job-header-grid__chip-row">
            <v-chip density="comfortable" variant="outlined"> Qty {{ normalizedQty }} </v-chip>
            <v-chip
              v-if="draft.dueDate"
              :color="dueDateColor(draft.dueDate)"
              density="comfortable"
              variant="tonal"
            >
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
          @click="requestPrintJobTraveler"
        >
          Traveler
        </v-btn>
        <v-btn
          color="green"
          :disabled="!canSaveJob"
          :loading="saving"
          prepend-icon="mdi-content-save-outline"
          @click="saveJob"
        >
          {{ isCreateRoute ? 'Create' : 'Save' }}
        </v-btn>
      </div>
    </v-tabs>

    <v-card>
      <v-window v-model="tab">
        <v-window-item value="general">
          <v-card-text>
            <v-form v-model="valid">
              <JobFormFields
                v-model="draft"
                :due-date-disabled="shipmentScheduleEnabled"
                :due-date-hint="dueDateFieldHint"
              />
            </v-form>
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
            <div class="shipments-tab">
              <div class="shipment-progress-grid">
                <v-card class="shipment-progress-card" variant="outlined">
                  <v-card-text>
                    <div class="shipment-progress-card__label">Total Qty</div>
                    <div class="shipment-progress-card__value">{{ normalizedQty }}</div>
                  </v-card-text>
                </v-card>
                <v-card class="shipment-progress-card" variant="outlined">
                  <v-card-text>
                    <div class="shipment-progress-card__label">Shipped</div>
                    <div class="shipment-progress-card__value-row">
                      <div class="shipment-progress-card__value">{{ shippedQty }}</div>
                      <v-chip v-if="isOverShipped" color="error" size="small" variant="tonal">
                        Over by {{ overShippedQty }}
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
                <v-card class="shipment-progress-card" variant="outlined">
                  <v-card-text>
                    <div class="shipment-progress-card__label">Left To Ship</div>
                    <div class="shipment-progress-card__value">{{ remainingShipmentQty }}</div>
                  </v-card-text>
                </v-card>
              </div>

              <div class="shipment-sections-grid">
                <div class="shipment-section shipment-plan">
                  <div class="shipment-plan__header">
                    <div class="shipment-plan__header-copy">
                      <div class="shipment-plan__header-title">
                        <div class="text-h6">Planned Shipments</div>
                        <v-chip color="primary" size="small" variant="tonal">
                          {{ plannedShipmentCount }}
                        </v-chip>
                      </div>
                      <div class="shipment-plan__header-hint text-body-2 text-medium-emphasis">
                        Final shipment auto-fills the remaining planned quantity.
                      </div>
                    </div>
                  </div>

                  <div class="shipment-plan__rows">
                    <v-card
                      v-for="(entry, index) in draft.shipmentSchedule"
                      :key="shipmentScheduleRowKey(entry, index)"
                      class="shipment-plan__row"
                      variant="outlined"
                    >
                      <v-card-text class="shipment-row-card__content">
                        <div class="shipment-plan__row-header mb-2">
                          <div class="text-subtitle-1 font-weight-medium">
                            Planned Shipment {{ index + 1 }}
                          </div>
                          <div class="shipment-plan__row-meta">
                            <v-chip
                              :color="plannedShipmentStatusColor(index)"
                              size="small"
                              variant="tonal"
                            >
                              {{ plannedShipmentStatusLabel(index) }}
                            </v-chip>
                            <div class="shipment-plan__row-buttons">
                              <v-btn
                                class="shipment-plan__ship-button"
                                :disabled="!canRecordPlannedShipment(index)"
                                prepend-icon="mdi-truck-fast-outline"
                                size="small"
                                variant="text"
                                @click="recordPlannedShipment(index)"
                              >
                                Ship
                              </v-btn>
                              <v-btn
                                class="shipment-plan__delete-button"
                                :disabled="draft.shipmentSchedule.length === 1"
                                icon="mdi-delete-outline"
                                size="small"
                                variant="text"
                                @click="removeShipmentScheduleEntry(index)"
                              />
                            </div>
                          </div>
                        </div>

                        <v-row dense>
                          <v-col cols="12" md="4">
                            <v-text-field
                              label="Shipment Date"
                              :model-value="entry.shipDate"
                              type="date"
                              variant="outlined"
                              @update:model-value="updateShipmentScheduleShipDate(index, $event)"
                            />
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              :disabled="isShipmentScheduleQtyLocked(index)"
                              :hint="shipmentScheduleQtyHint(index)"
                              label="Planned Qty"
                              min="1"
                              :model-value="shipmentScheduleQtyInputValue(index)"
                              persistent-hint
                              type="number"
                              variant="outlined"
                              @update:model-value="updateShipmentScheduleQty(index, $event)"
                            />
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              label="PO"
                              :model-value="entry.po"
                              variant="outlined"
                              @update:model-value="updateShipmentSchedulePo(index, $event)"
                            />
                          </v-col>
                        </v-row>
                      </v-card-text>
                    </v-card>
                  </div>

                  <div class="shipment-plan__actions">
                    <v-btn
                      :disabled="!canEqualizeShipmentSchedule()"
                      prepend-icon="mdi-equal-box"
                      variant="text"
                      @click="equalizeShipmentSchedule"
                    >
                      Equalize Shipments
                    </v-btn>
                    <v-btn prepend-icon="mdi-plus" variant="text" @click="addShipmentScheduleEntry">
                      Add Planned Shipment
                    </v-btn>
                  </div>
                </div>

                <div class="shipment-section shipment-log">
                  <div class="shipment-log__header">
                    <div class="shipment-log__header-copy">
                      <div class="text-h6">Recorded Shipments</div>
                      <div class="text-body-2 text-medium-emphasis mt-2">
                        Record every shipment here, including partial or unplanned shipments.
                      </div>
                    </div>
                  </div>

                  <div v-if="draft.shipmentRecords.length" class="shipment-log__rows">
                    <v-card
                      v-for="(entry, index) in draft.shipmentRecords"
                      :key="entry.id"
                      class="shipment-log__row"
                      variant="outlined"
                    >
                      <v-card-text class="shipment-row-card__content">
                        <div class="shipment-log__row-header">
                          <div class="text-subtitle-1 font-weight-medium">
                            Shipment {{ index + 1 }}
                          </div>
                          <v-btn
                            icon="mdi-delete-outline"
                            size="small"
                            variant="text"
                            @click="removeShipmentRecord(index)"
                          />
                        </div>

                        <v-row dense>
                          <v-col cols="12" md="4">
                            <v-text-field
                              label="Shipped On"
                              :model-value="entry.shippedAt"
                              type="date"
                              variant="outlined"
                              @update:model-value="updateShipmentRecordDate(index, $event)"
                            />
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              :hint="shipmentRecordQtyHint(index)"
                              label="Qty"
                              min="1"
                              :model-value="entry.qty"
                              persistent-hint
                              type="number"
                              variant="outlined"
                              @update:model-value="updateShipmentRecordQty(index, $event)"
                            />
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              label="PO"
                              :model-value="entry.po"
                              variant="outlined"
                              @update:model-value="updateShipmentRecordPo(index, $event)"
                            />
                          </v-col>
                        </v-row>
                      </v-card-text>
                    </v-card>
                  </div>

                  <div class="shipment-log__actions">
                    <v-btn
                      prepend-icon="mdi-truck-plus-outline"
                      variant="text"
                      @click="addShipmentRecord()"
                    >
                      Add Shipment
                    </v-btn>
                  </div>
                </div>
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

    <v-dialog v-model="printClosedConfirm" max-width="420">
      <v-card>
        <v-card-title>Print Closed Job Traveler?</v-card-title>
        <v-card-text>
          <div>
            <strong v-if="job">Job #{{ job.jobNumber }}</strong>
            <span v-else>This job</span>
            is closed. Are you sure you want to print the traveler?
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="printClosedConfirm = false">Cancel</v-btn>
          <v-btn color="warning" :loading="travelerLoading" @click="confirmPrintJobTraveler">
            Print Traveler
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="closeAfterShipmentConfirm" max-width="460">
      <v-card>
        <v-card-title>Close Fully Shipped Job?</v-card-title>
        <v-card-text>
          <div>
            Recorded shipments now leave this job with nothing left to ship.
            <span v-if="isOverShipped"> It is currently over by {{ overShippedQty }}.</span>
          </div>
          <div class="text-medium-emphasis mt-3">
            Do you want to close the job as part of this save?
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeAfterShipmentConfirm = false">Cancel</v-btn>
          <v-btn variant="text" @click="confirmSaveWithOpenJob">Keep Open</v-btn>
          <v-btn color="primary" @click="confirmSaveWithClosedJob">Close Job</v-btn>
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
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <div class="machine-option__row">
                      <span>{{ machineDisplayName(item) }}</span>
                      <span
                        class="machine-option__status-dot"
                        :class="machineAvailabilityClass(item)"
                      />
                    </div>
                  </v-list-item>
                </template>

                <template #selection="{ item }">
                  <div class="machine-option__row machine-option__row--selection">
                    <span>{{ machineDisplayName(item) }}</span>
                    <span
                      class="machine-option__status-dot"
                      :class="machineAvailabilityClass(item)"
                    />
                  </div>
                </template>
              </v-select>
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
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <div class="machine-option__row">
                      <span>{{ machineDisplayName(item) }}</span>
                      <span
                        class="machine-option__status-dot"
                        :class="machineAvailabilityClass(item)"
                      />
                    </div>
                  </v-list-item>
                </template>

                <template #selection="{ item }">
                  <div class="machine-option__row machine-option__row--selection">
                    <span>{{ machineDisplayName(item) }}</span>
                    <span
                      class="machine-option__status-dot"
                      :class="machineAvailabilityClass(item)"
                    />
                  </div>
                </template>
              </v-select>
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
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <div class="machine-option__row">
                      <span>{{ machineDisplayName(item) }}</span>
                      <span
                        class="machine-option__status-dot"
                        :class="machineAvailabilityClass(item)"
                      />
                    </div>
                  </v-list-item>
                </template>

                <template #selection="{ item }">
                  <div class="machine-option__row machine-option__row--selection">
                    <span>{{ machineDisplayName(item) }}</span>
                    <span
                      class="machine-option__status-dot"
                      :class="machineAvailabilityClass(item)"
                    />
                  </div>
                </template>
              </v-select>
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
import { calculateTaskBusinessDurationMs } from '@repo/utilities/time';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import JobFormFields, { type JobDraft } from '@/components/jobs/JobFormFields.vue';
import MaterialSwatch from '@/components/jobs/MaterialSwatch.vue';
import { dueDateColor } from '@/lib/job_dates';
import api, { statusApi } from '@/plugins/axios';
import printer from '@/plugins/printer';
import { toastError } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { isAdmin } from '@/state/device';
import { useJobsStore } from '@/stores/jobs_store';

const JOB_TAB_VALUES = ['general', 'production', 'shipments'] as const;

type JobShipmentScheduleDraftEntry = {
  shipDate: string;
  qty: string;
  po: string;
};

type JobShipmentRecordDraftEntry = {
  id: string;
  shippedAt: string;
  qty: string;
  po: string;
};

type StartTaskMachineOption = MachineInfo & {
  hasRunningTask: boolean;
  runningTaskJobNumber: number | null;
};

type MachineDashboardActivity = Pick<MachineJobDashboardRow, 'machineId' | 'jobNumber'>;

const route = useRoute();
const jobsStore = useJobsStore();

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const travelerLoading = ref(false);
const deleteConfirm = ref(false);
const printClosedConfirm = ref(false);
const closeAfterShipmentConfirm = ref(false);
const machines = ref<StartTaskMachineOption[]>([]);
const machinesLoading = ref(false);
const machinesLoadFailed = ref(false);
const productionTaskLoading = ref(false);
const startTaskDialog = ref(false);
const endTaskConfirmTaskId = ref<string | null>(null);
const job = ref<Job | null>(null);
const draft = ref(createEmptyDraft());
const createRouteHydrationKey = ref<string | null>(null);
const tab = ref<(typeof JOB_TAB_VALUES)[number]>('general');
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
    (typeof job.value.part === 'string' ? '' : job.value.part?.part || '') ||
    job.value.partNumber ||
    '';
  const partDescription =
    (typeof job.value.part === 'string' ? '' : job.value.part?.description || '') ||
    job.value.partDescription ||
    '';

  return [customerName, [partNumber, partDescription].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(' | ');
});
const partHeaderTitle = computed(() => {
  if (isCreateRoute.value) return 'Select part details';
  if (!job.value) return 'Part details';

  const partNumber =
    (typeof job.value.part === 'string' ? '' : job.value.part?.part || '') ||
    job.value.partNumber ||
    '';
  const partDescription =
    (typeof job.value.part === 'string' ? '' : job.value.part?.description || '') ||
    job.value.partDescription ||
    '';

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
const shipmentScheduleEnabled = computed(() => draft.value.shipmentSchedule.length > 0);
const plannedShipmentCount = computed(() => draft.value.shipmentSchedule.length);
const totalRecordedShipmentQty = computed(() =>
  draft.value.shipmentRecords.reduce((sum, entry) => sum + Math.max(0, Number(entry.qty) || 0), 0),
);
const shippedQty = computed(() => totalRecordedShipmentQty.value);
const remainingShipmentQty = computed(() =>
  Math.max(normalizedQty.value - totalRecordedShipmentQty.value, 0),
);
const isOverShipped = computed(() => shippedQty.value > normalizedQty.value);
const overShippedQty = computed(() => Math.max(shippedQty.value - normalizedQty.value, 0));
const dueDateFieldHint = computed(() => {
  if (shipmentScheduleEnabled.value) {
    const firstShipDate = draft.value.shipmentSchedule[0]?.shipDate || '';
    return firstShipDate
      ? `Driven by Shipment 1: ${formatRelativeDateLabel(firstShipDate)}`
      : 'Driven by Shipment 1';
  }

  return formatRelativeDateLabel(draft.value.dueDate);
});
const priorityLabel = computed(() => {
  if (draft.value.priority === 'rush') return 'Rush';
  if (draft.value.priority === 'low') return 'Low';
  return 'Normal';
});
const normalizedQty = computed(() => Math.max(1, Number(draft.value.qty) || 1));
const shipmentRecordsChanged = computed(() => {
  const baselineDraft = isCreateRoute.value
    ? createEmptyDraft()
    : job.value
      ? jobToDraft(job.value)
      : null;
  if (!baselineDraft) return false;

  return (
    JSON.stringify(normalizeShipmentRecordsDraft(draft.value)) !==
    JSON.stringify(normalizeShipmentRecordsDraft(baselineDraft))
  );
});
const draftIsAltered = computed(() => {
  const baselineDraft = isCreateRoute.value
    ? createEmptyDraft()
    : job.value
      ? jobToDraft(job.value)
      : null;
  if (!baselineDraft) return false;
  return serializeDraft(draft.value) !== serializeDraft(baselineDraft);
});
const saveValidationError = computed(() =>
  validateDraft(draft.value, job.value?.productionTasks ?? []),
);
const shouldPromptCloseAfterShipmentSave = computed(
  () =>
    shipmentRecordsChanged.value &&
    remainingShipmentQty.value === 0 &&
    draft.value.status !== 'closed',
);
const canSaveJob = computed(() => draftIsAltered.value && !saveValidationError.value);
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
const machineOptionsByType = computed<Record<MachineType, StartTaskMachineOption[]>>(() => ({
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

watch(tab, (value) => {
  syncTabToQuery(value);
});

onMounted(async () => {
  await syncRouteState();
  await fetchMachines();
});

function createEmptyDraft(): JobDraft {
  const defaultDueDate = defaultDueDateValue();

  return {
    customer: null,
    part: null,
    qty: '1',
    status: 'open',
    dueDate: defaultDueDate,
    startedOn: '',
    completedOn: '',
    materialOrderedOn: '',
    materialOnHandOn: '',
    customerPo: '',
    priority: 'normal',
    notes: '',
    shipmentSchedule: [createSingleShipmentScheduleDraftEntry(defaultDueDate, '1')],
    shipmentRecords: [],
  };
}

function defaultDueDateValue() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
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

function firstRouteQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function createDraftFromRouteQuery() {
  const nextDraft = createEmptyDraft();
  const customerQuery = firstRouteQueryValue(route.query.customer);
  const partQuery = firstRouteQueryValue(route.query.part);

  if (typeof customerQuery === 'string' && customerQuery.trim()) {
    nextDraft.customer = customerQuery.trim();
  }

  if (typeof partQuery === 'string' && partQuery.trim()) {
    nextDraft.part = partQuery.trim();
  }

  return nextDraft;
}

function currentCreateRouteHydrationKey() {
  const customerQuery = firstRouteQueryValue(route.query.customer);
  const partQuery = firstRouteQueryValue(route.query.part);

  return JSON.stringify({
    name: route.name,
    customer: typeof customerQuery === 'string' ? customerQuery.trim() : '',
    part: typeof partQuery === 'string' ? partQuery.trim() : '',
  });
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
    materialOrderedOn: value.materialOrderedOn || '',
    materialOnHandOn: value.materialOnHandOn || '',
    customerPo: value.customerPo.trim(),
    priority: value.priority,
    notes: value.notes.trim(),
    shipmentSchedule: normalizeShipmentScheduleDraft(value),
    shipmentRecords: normalizeShipmentRecordsDraft(value),
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
  const fallbackShipDate = dateInputValue(currentJob.dueDate) || defaultDueDateValue();
  const shipmentSchedule = currentJob.shipmentSchedule?.length
    ? currentJob.shipmentSchedule.map((entry) => ({
        shipDate: dateInputValue(entry.shipDate),
        qty: String(Math.max(1, Number(entry.qty) || 1)),
        po: entry.po || '',
      }))
    : [createSingleShipmentScheduleDraftEntry(fallbackShipDate, String(currentJob.qty))];

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
    materialOrderedOn: dateInputValue(currentJob.materialOrderedOn),
    materialOnHandOn: dateInputValue(currentJob.materialOnHandOn),
    customerPo: currentJob.customerPo || '',
    priority: currentJob.priority || 'normal',
    notes: currentJob.notes || '',
    shipmentSchedule,
    shipmentRecords: (currentJob.shipmentRecords || []).map((entry) => ({
      id: entry.id,
      shippedAt: dateInputValue(entry.shippedAt),
      qty: String(Math.max(1, Number(entry.qty) || 1)),
      po: entry.po || '',
    })),
  };
}

function validateDraft(nextDraft: JobDraft, existingProductionTasks: JobProductionTask[]) {
  if (!nextDraft.customer) return 'Select a customer.';
  if (!nextDraft.part) return 'Select a part.';
  if (Math.max(0, Number(nextDraft.qty) || 0) < 1) return 'Qty must be at least 1.';
  const shipmentScheduleError = validateShipmentScheduleDraft(nextDraft);
  if (shipmentScheduleError) return shipmentScheduleError;
  const shipmentRecordsError = validateShipmentRecordsDraft(nextDraft);
  if (shipmentRecordsError) return shipmentRecordsError;
  if (
    nextDraft.status === 'closed' &&
    existingProductionTasks.some((productionTask) => !productionTask.endedAt)
  ) {
    return 'All production tasks must be ended before closing the job.';
  }
  return null;
}

function toJobPayload(nextDraft: JobDraft, productionTasks: JobProductionTask[] = []): JobCreate {
  const shipmentSchedule = normalizeShipmentScheduleDraft(nextDraft);
  const shipmentRecords = normalizeShipmentRecordsDraft(nextDraft);

  return {
    customer: nextDraft.customer || '',
    part: nextDraft.part || '',
    qty: Math.max(1, Number(nextDraft.qty) || 1),
    status: nextDraft.status,
    dueDate: shipmentSchedule[0]?.shipDate || nextDraft.dueDate || undefined,
    startedOn: nextDraft.startedOn || undefined,
    completedOn: nextDraft.status === 'closed' ? nextDraft.completedOn || undefined : undefined,
    materialOrderedOn: nextDraft.materialOrderedOn || undefined,
    materialOnHandOn: nextDraft.materialOnHandOn || undefined,
    customerPo: nextDraft.customerPo.trim() || undefined,
    priority: nextDraft.priority,
    notes: nextDraft.notes.trim() || undefined,
    shipmentSchedule: shipmentSchedule.length ? shipmentSchedule : undefined,
    shipmentRecords: shipmentRecords.length ? shipmentRecords : undefined,
    productionTasks,
  };
}

function normalizedDraftQty(value: string) {
  return Math.max(1, Number(value) || 1);
}

function suggestedSplitQty(totalQty: number) {
  if (totalQty <= 1) return 1;
  return Math.max(1, Math.floor(totalQty / 2));
}

function createShipmentScheduleDraftEntry(
  shipDate = draft.value.dueDate || defaultDueDateValue(),
  qty = String(suggestedSplitQty(normalizedQty.value)),
  po = '',
): JobShipmentScheduleDraftEntry {
  return {
    shipDate,
    qty,
    po,
  };
}

function createSingleShipmentScheduleDraftEntry(
  shipDate = defaultDueDateValue(),
  qty = '1',
  po = '',
): JobShipmentScheduleDraftEntry {
  return {
    shipDate,
    qty: String(Math.max(1, Number(qty) || 1)),
    po,
  };
}

function createShipmentRecordDraftEntry(
  shippedAt = currentDateInputValue(),
  qty = String(defaultShipmentRecordQty()),
  po = '',
): JobShipmentRecordDraftEntry {
  return {
    id: crypto.randomUUID(),
    shippedAt,
    qty,
    po,
  };
}

function defaultShipmentRecordQty() {
  return remainingShipmentQty.value > 0 ? remainingShipmentQty.value : 1;
}

function isShipmentScheduleRemainderEntry(index: number) {
  return (
    draft.value.shipmentSchedule.length > 1 && index === draft.value.shipmentSchedule.length - 1
  );
}

function isShipmentScheduleQtyLocked(index: number) {
  return draft.value.shipmentSchedule.length === 1 || isShipmentScheduleRemainderEntry(index);
}

function plannedShipmentQtyAt(index: number) {
  const totalQty = normalizedQty.value;
  const schedule = draft.value.shipmentSchedule;
  if (!schedule.length) return totalQty;
  if (schedule.length === 1) return totalQty;

  if (index === schedule.length - 1) {
    const allocatedQty = schedule
      .slice(0, -1)
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.qty) || 0), 0);
    return Math.max(totalQty - allocatedQty, 0);
  }

  return Math.max(0, Number(schedule[index]?.qty) || 0);
}

function shipmentScheduleQtyInputValue(index: number) {
  if (isShipmentScheduleRemainderEntry(index)) {
    return String(plannedShipmentQtyAt(index));
  }

  if (draft.value.shipmentSchedule.length === 1) {
    return String(normalizedQty.value);
  }

  return draft.value.shipmentSchedule[index]?.qty || '';
}

function shipmentScheduleQtyHint(index: number) {
  if (draft.value.shipmentSchedule.length === 1) {
    return ''; //'Single planned shipment carries the full job quantity. Add another row to split it.';
  }

  if (isShipmentScheduleRemainderEntry(index)) {
    return `${plannedShipmentQtyAt(index)} remaining from ${normalizedQty.value} total.`;
  }

  return `Remainder after this shipment: ${Math.max(normalizedQty.value - scheduledQtyBeforeIndex(index + 1), 0)}`;
}

function plannedShipmentShippedQtyAt(index: number) {
  let remainingRecordedQty = totalRecordedShipmentQty.value;

  for (let currentIndex = 0; currentIndex <= index; currentIndex += 1) {
    const allocatedQty = Math.min(
      plannedShipmentQtyAt(currentIndex),
      Math.max(remainingRecordedQty, 0),
    );
    if (currentIndex === index) return allocatedQty;
    remainingRecordedQty -= allocatedQty;
  }

  return 0;
}

function plannedShipmentRemainingQtyAt(index: number) {
  return Math.max(plannedShipmentQtyAt(index) - plannedShipmentShippedQtyAt(index), 0);
}

function plannedShipmentStatusLabel(index: number) {
  const plannedQty = plannedShipmentQtyAt(index);
  const remainingQty = plannedShipmentRemainingQtyAt(index);
  const shippedQtyForPlan = plannedQty - remainingQty;

  if (remainingQty <= 0) return 'Shipped';
  if (shippedQtyForPlan > 0) return `Partial ${shippedQtyForPlan}/${plannedQty}`;
  return 'Planned';
}

function plannedShipmentStatusColor(index: number) {
  const plannedQty = plannedShipmentQtyAt(index);
  const remainingQty = plannedShipmentRemainingQtyAt(index);
  if (remainingQty <= 0) return 'success';
  if (remainingQty < plannedQty) return 'warning';
  return 'grey';
}

function canRecordPlannedShipment(index: number) {
  if (plannedShipmentRemainingQtyAt(index) < 1) return false;

  for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
    if (plannedShipmentRemainingQtyAt(currentIndex) > 0) {
      return false;
    }
  }

  return true;
}

function scheduledQtyBeforeIndex(endIndex: number) {
  return draft.value.shipmentSchedule.slice(0, endIndex).reduce((sum, entry, index) => {
    if (
      draft.value.shipmentSchedule.length > 1 &&
      index === draft.value.shipmentSchedule.length - 1
    ) {
      return sum;
    }

    return sum + Math.max(0, Number(entry.qty) || 0);
  }, 0);
}

function normalizeShipmentScheduleDraft(nextDraft: JobDraft): JobShipmentScheduleEntry[] {
  if (!nextDraft.shipmentSchedule.length) return [];

  const totalQty = normalizedDraftQty(nextDraft.qty);
  const schedule = nextDraft.shipmentSchedule
    .map((entry) => ({
      shipDate: entry.shipDate.trim(),
      qty: Math.max(0, Number(entry.qty) || 0),
      po: entry.po.trim(),
    }))
    .filter((entry) => entry.shipDate);

  if (!schedule.length) return [];

  if (schedule.length === 1) {
    return [
      {
        shipDate: schedule[0].shipDate,
        qty: totalQty,
        po: schedule[0].po || undefined,
      },
    ];
  }

  let allocatedQty = 0;

  return schedule.map((entry, index) => {
    if (index === schedule.length - 1) {
      return {
        shipDate: entry.shipDate,
        qty: Math.max(totalQty - allocatedQty, 0),
        po: entry.po || undefined,
      };
    }

    const qty = Math.max(0, Math.trunc(entry.qty));
    allocatedQty += qty;
    return {
      shipDate: entry.shipDate,
      qty,
      po: entry.po || undefined,
    };
  });
}

function normalizeShipmentRecordsDraft(nextDraft: JobDraft): JobShipmentRecord[] {
  return nextDraft.shipmentRecords.map((entry) => ({
    id: entry.id.trim(),
    shippedAt: entry.shippedAt.trim(),
    qty: Math.max(0, Math.trunc(Number(entry.qty) || 0)),
    po: entry.po.trim() || undefined,
  }));
}

function canEqualizeShipmentSchedule() {
  return (
    draft.value.shipmentSchedule.length > 1 &&
    normalizedQty.value >= draft.value.shipmentSchedule.length
  );
}

function validateShipmentScheduleDraft(nextDraft: JobDraft) {
  if (!nextDraft.shipmentSchedule.length) return null;

  const totalQty = normalizedDraftQty(nextDraft.qty);
  const schedule = nextDraft.shipmentSchedule;

  for (const [index, entry] of schedule.entries()) {
    if (!entry.shipDate.trim()) {
      return `Shipment ${index + 1} needs a shipment date.`;
    }
  }

  if (schedule.length === 1) return null;

  let allocatedQty = 0;
  for (const [index, entry] of schedule.entries()) {
    const isLastEntry = index === schedule.length - 1;
    if (isLastEntry) {
      if (totalQty - allocatedQty < 1) {
        return 'Shipment quantities before the final shipment must leave a remainder.';
      }
      continue;
    }

    const qty = Math.trunc(Number(entry.qty) || 0);
    if (qty < 1) {
      return `Shipment ${index + 1} qty must be at least 1.`;
    }

    allocatedQty += qty;
    if (allocatedQty >= totalQty) {
      return 'Shipment quantities before the final shipment must leave a remainder.';
    }
  }

  return null;
}

function validateShipmentRecordsDraft(nextDraft: JobDraft) {
  if (!nextDraft.shipmentRecords.length) return null;

  const normalizedRecords = normalizeShipmentRecordsDraft(nextDraft);
  let totalQtyRecorded = 0;

  for (const [index, record] of normalizedRecords.entries()) {
    if (!record.id) {
      return `Recorded shipment ${index + 1} is missing an id.`;
    }
    if (typeof record.shippedAt !== 'string' || !record.shippedAt.trim()) {
      return `Recorded shipment ${index + 1} needs a shipment date.`;
    }
    if (record.qty < 1) {
      return `Recorded shipment ${index + 1} qty must be at least 1.`;
    }

    totalQtyRecorded += record.qty;
    if (totalQtyRecorded > normalizedDraftQty(nextDraft.qty)) {
      return 'Recorded shipments cannot exceed the job quantity.';
    }
  }

  return null;
}

function addShipmentScheduleEntry() {
  const schedule = draft.value.shipmentSchedule;
  if (!schedule.length) {
    const fallbackDate = draft.value.dueDate || defaultDueDateValue();
    draft.value = {
      ...draft.value,
      dueDate: fallbackDate,
      shipmentSchedule: [
        createSingleShipmentScheduleDraftEntry(fallbackDate, String(normalizedQty.value)),
      ],
    };
  }

  const nextSchedule = draft.value.shipmentSchedule;

  if (nextSchedule.length === 1) {
    draft.value = {
      ...draft.value,
      shipmentSchedule: [
        {
          ...nextSchedule[0],
          qty: String(suggestedSplitQty(normalizedQty.value)),
        },
        createShipmentScheduleDraftEntry(nextSchedule[0].shipDate, ''),
      ],
    };
    return;
  }

  const insertionIndex = nextSchedule.length - 1;
  const finalRemainderQty = plannedShipmentQtyAt(nextSchedule.length - 1);
  const nextQty = String(suggestedSplitQty(finalRemainderQty));

  draft.value = {
    ...draft.value,
    shipmentSchedule: [
      ...nextSchedule.slice(0, insertionIndex),
      createShipmentScheduleDraftEntry(nextSchedule[insertionIndex].shipDate, nextQty),
      ...nextSchedule.slice(insertionIndex),
    ],
  };
}

function equalizeShipmentSchedule() {
  if (!canEqualizeShipmentSchedule()) {
    toastError('Qty is too low to evenly distribute across the planned shipment rows.');
    return;
  }

  const totalQty = normalizedQty.value;
  const rowCount = draft.value.shipmentSchedule.length;
  const baseQty = Math.floor(totalQty / rowCount);
  const remainder = totalQty % rowCount;

  draft.value = {
    ...draft.value,
    shipmentSchedule: draft.value.shipmentSchedule.map((entry, index) => ({
      ...entry,
      qty: String(index === rowCount - 1 ? baseQty + remainder : baseQty),
    })),
  };
}

function addShipmentRecord(
  qty = String(defaultShipmentRecordQty()),
  shippedAt = currentDateInputValue(),
  po = '',
) {
  draft.value = {
    ...draft.value,
    shipmentRecords: [
      ...draft.value.shipmentRecords,
      createShipmentRecordDraftEntry(shippedAt, qty, po),
    ],
  };
}

function recordPlannedShipment(index: number) {
  if (!canRecordPlannedShipment(index)) return;

  const remainingPlannedQty = plannedShipmentRemainingQtyAt(index);
  if (remainingPlannedQty < 1) return;

  addShipmentRecord(
    String(remainingPlannedQty),
    draft.value.shipmentSchedule[index]?.shipDate || currentDateInputValue(),
    draft.value.shipmentSchedule[index]?.po || '',
  );
}

function removeShipmentScheduleEntry(index: number) {
  if (draft.value.shipmentSchedule.length === 1) return;

  const nextSchedule = draft.value.shipmentSchedule.filter(
    (_, currentIndex) => currentIndex !== index,
  );
  draft.value = {
    ...draft.value,
    shipmentSchedule: nextSchedule,
  };
}

function removeShipmentRecord(index: number) {
  draft.value = {
    ...draft.value,
    shipmentRecords: draft.value.shipmentRecords.filter(
      (_, currentIndex) => currentIndex !== index,
    ),
  };
}

function updateShipmentScheduleShipDate(index: number, value: string) {
  const nextSchedule = draft.value.shipmentSchedule.map((entry, currentIndex) =>
    currentIndex === index
      ? {
          ...entry,
          shipDate: value,
        }
      : entry,
  );

  draft.value = {
    ...draft.value,
    dueDate: index === 0 ? value : draft.value.dueDate,
    shipmentSchedule: nextSchedule,
  };
}

function updateShipmentScheduleQty(index: number, value: string) {
  if (isShipmentScheduleRemainderEntry(index) || draft.value.shipmentSchedule.length === 1) {
    return;
  }

  draft.value = {
    ...draft.value,
    shipmentSchedule: draft.value.shipmentSchedule.map((entry, currentIndex) =>
      currentIndex === index
        ? {
            ...entry,
            qty: value,
          }
        : entry,
    ),
  };
}

function updateShipmentSchedulePo(index: number, value: string) {
  draft.value = {
    ...draft.value,
    shipmentSchedule: draft.value.shipmentSchedule.map((entry, currentIndex) =>
      currentIndex === index
        ? {
            ...entry,
            po: value,
          }
        : entry,
    ),
  };
}

function updateShipmentRecordDate(index: number, value: string) {
  draft.value = {
    ...draft.value,
    shipmentRecords: draft.value.shipmentRecords.map((entry, currentIndex) =>
      currentIndex === index
        ? {
            ...entry,
            shippedAt: value,
          }
        : entry,
    ),
  };
}

function updateShipmentRecordQty(index: number, value: string) {
  draft.value = {
    ...draft.value,
    shipmentRecords: draft.value.shipmentRecords.map((entry, currentIndex) =>
      currentIndex === index
        ? {
            ...entry,
            qty: value,
          }
        : entry,
    ),
  };
}

function updateShipmentRecordPo(index: number, value: string) {
  draft.value = {
    ...draft.value,
    shipmentRecords: draft.value.shipmentRecords.map((entry, currentIndex) =>
      currentIndex === index
        ? {
            ...entry,
            po: value,
          }
        : entry,
    ),
  };
}

function shipmentRecordQtyHint(index: number) {
  const totalAfterRow = draft.value.shipmentRecords.slice(0, index + 1).reduce((sum, entry) => {
    return sum + Math.max(0, Number(entry.qty) || 0);
  }, 0);
  const remainingAfterRow = normalizedQty.value - totalAfterRow;

  if (remainingAfterRow < 0) {
    return `Over by ${Math.abs(remainingAfterRow)}.`;
  }

  return `Remaining after this shipment: ${remainingAfterRow}`;
}

function shipmentScheduleRowKey(entry: JobShipmentScheduleDraftEntry, index: number) {
  return `${entry.shipDate || 'shipment'}-${index}`;
}

function formatRelativeDateLabel(value: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
  }

  return formatHeaderDate(value);
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
  tab.value = selectedRouteTab();
  closeStartTaskDialog();
  endTaskConfirmTaskId.value = null;

  if (isCreateRoute.value) {
    const nextHydrationKey = currentCreateRouteHydrationKey();

    job.value = null;
    if (createRouteHydrationKey.value !== nextHydrationKey) {
      draft.value = createDraftFromRouteQuery();
      createRouteHydrationKey.value = nextHydrationKey;
    }
    loading.value = false;
    return;
  }

  createRouteHydrationKey.value = null;

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

function selectedRouteTab(): (typeof JOB_TAB_VALUES)[number] {
  const queryValue = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
  return isJobTab(queryValue) ? queryValue : 'general';
}

function isJobTab(value: unknown): value is (typeof JOB_TAB_VALUES)[number] {
  return (
    typeof value === 'string' && JOB_TAB_VALUES.includes(value as (typeof JOB_TAB_VALUES)[number])
  );
}

function syncTabToQuery(value: (typeof JOB_TAB_VALUES)[number]) {
  const currentTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
  const nextQuery = {
    ...route.query,
    ...(value === 'general' ? {} : { tab: value }),
  };

  if (value === 'general') {
    delete nextQuery.tab;
  }

  if (currentTab === nextQuery.tab || (!currentTab && !nextQuery.tab)) {
    return;
  }

  void router.replace({ query: nextQuery });
}

async function fetchMachines() {
  machinesLoading.value = true;
  machinesLoadFailed.value = false;

  try {
    const [{ data: machineData }, machineActivityMap] = await Promise.all([
      statusApi.get<MachineInfo[]>('/machines'),
      fetchMachineActivityMap(),
    ]);
    machines.value = machineData.map((machine) => {
      const activity = machineActivityMap.get(machine.id) ?? null;
      return {
        ...machine,
        hasRunningTask: Boolean(activity),
        runningTaskJobNumber: activity?.jobNumber ?? null,
      };
    });
  } catch {
    machines.value = [];
    machinesLoadFailed.value = true;
    toastError('Unable to load machines.');
  } finally {
    machinesLoading.value = false;
  }
}

async function fetchMachineActivityMap() {
  const { data } = await api.get<MachineJobDashboardResponse>('/jobs/machine-dashboard');
  return new Map<string, MachineDashboardActivity>(
    data.active.map((machine) => [
      machine.machineId,
      {
        machineId: machine.machineId,
        jobNumber: machine.jobNumber ?? null,
      },
    ]),
  );
}

async function saveJob() {
  if (!canSaveJob.value) return;

  if (shouldPromptCloseAfterShipmentSave.value) {
    closeAfterShipmentConfirm.value = true;
    return;
  }

  await persistJob(draft.value);
}

async function persistJob(nextDraft: JobDraft) {
  const errorMessage = validateDraft(nextDraft, job.value?.productionTasks ?? []);
  if (errorMessage) {
    toastError(errorMessage);
    return;
  }

  saving.value = true;
  try {
    const payload = toJobPayload(nextDraft, job.value?.productionTasks ?? []);

    if (isCreateRoute.value) {
      const createdJob = await jobsStore.create(payload);
      job.value = createdJob;
      draft.value = jobToDraft(createdJob);
      await printJobTraveler();
      // await router.replace({ name: 'viewJob', params: { id: createdJob._id } });
      void router.back();
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
    void router.back();
  } finally {
    saving.value = false;
  }
}

function confirmSaveWithOpenJob() {
  closeAfterShipmentConfirm.value = false;
  void persistJob(draft.value);
}

function confirmSaveWithClosedJob() {
  closeAfterShipmentConfirm.value = false;
  void persistJob(applyJobStatus(draft.value, 'closed'));
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

function requestPrintJobTraveler() {
  if (!job.value?._id) return;
  if (job.value.status === 'closed') {
    printClosedConfirm.value = true;
    return;
  }

  void printJobTraveler();
}

async function confirmPrintJobTraveler() {
  printClosedConfirm.value = false;
  await printJobTraveler();
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
  const totalMs = calculateTaskBusinessDurationMs(
    task,
    {
      timeZone: 'America/Denver',
    },
    new Date(),
  );

  if (!task.endedAt) return `${formatElapsedDuration(totalMs)} (in progress)`;
  if (!totalMs) return '';

  return formatElapsedDuration(totalMs);
}

function formatElapsedDuration(valueMs: number) {
  const totalMinutes = Math.max(0, Math.round(valueMs / 60000));
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

function machineDisplayName(machine: StartTaskMachineOption) {
  return machine.displayName || machine.name;
}

function machineAvailabilityClass(machine: StartTaskMachineOption) {
  return machine.hasRunningTask
    ? 'machine-option__status-dot--running'
    : 'machine-option__status-dot--available';
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

.shipments-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.shipment-sections-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  align-items: start;
}

.shipment-section {
  min-width: 0;
}

.shipment-progress-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.shipment-progress-card__label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(0, 0, 0, 0.6);
}

.shipment-progress-card__value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.shipment-progress-card__value-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.shipment-plan {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shipment-plan__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.shipment-plan__header-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 56px;
}

.shipment-plan__header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.shipment-plan__header-hint {
  max-width: 42rem;
}

.shipment-plan__rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shipment-plan__row,
.shipment-log__row {
  min-height: 144px;
}

.shipment-row-card__content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100%;
  padding-top: 14px;
  padding-right: 16px;
  padding-bottom: 14px;
  padding-left: 16px;
}

.shipment-plan__row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.shipment-plan__row-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.shipment-plan__row-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.shipment-plan__ship-button,
.shipment-plan__delete-button {
  min-width: 0;
}

.shipment-plan__ship-button {
  padding-inline: 6px;
}

.shipment-plan__delete-button {
  padding-inline: 0;
}

.shipment-plan__actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.shipment-plan__empty {
  padding: 12px 0;
}

.shipment-log {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shipment-log__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.shipment-log__header-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 56px;
}

.shipment-log__actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.shipment-log__rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shipment-log__row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.shipment-log__empty {
  padding: 12px 0;
}

.job-header-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
}

@media (max-width: 900px) {
  .shipment-progress-grid {
    grid-template-columns: 1fr;
  }

  .shipment-sections-grid {
    grid-template-columns: 1fr;
  }

  .shipment-plan__header,
  .shipment-log__header {
    flex-direction: column;
  }
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

.machine-option__row {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  min-width: 0;
  width: 100%;
}

.machine-option__row--selection {
  padding-right: 4px;
}

.machine-option__status-dot {
  border-radius: 999px;
  display: inline-block;
  flex: 0 0 auto;
  height: 14px;
  width: 14px;
}

.machine-option__status-dot--available {
  background-color: #9a9a9a;
}

.machine-option__status-dot--running {
  background-color: rgba(var(--v-theme-success), 0.8);
}
</style>
