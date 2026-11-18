<template>
  <v-row>
    <v-col cols="12" lg="8" md="7">
      <v-row no-gutters>
        <v-col cols="12">
          <v-text-field
            :hint="productPriceHint"
            inputmode="decimal"
            label="Product Price"
            min="0"
            :model-value="priceInput ?? formatCost(part.price)"
            :persistent-hint="Boolean(productPriceHint)"
            prefix="$"
            type="text"
            @blur="onPriceBlur"
            @focus="priceInput = part.price ? formatCost(part.price) : ''"
            @keydown="onlyAllowNumeric($event)"
            @update:model-value="onPriceUpdate"
          />
        </v-col>
      </v-row>

      <v-divider class="my-1" />
      <template v-if="hasSubComponents">
        <div class="mb-2 font-weight-bold">Sub-Component Cycle Summary</div>
        <v-card border class="mb-4" variant="tonal">
          <v-card-text>
            <div class="text-body-2 text-medium-emphasis mb-3">
              Cycle time for this assembly is derived from its attached sub-components plus its own
              routing below.
            </div>
            <v-table class="rounded bg-transparent" density="compact">
              <colgroup>
                <col class="assembly-name-col" />
                <col class="assembly-meta-col" />
                <col class="assembly-chip-col" />
              </colgroup>
              <tbody>
                <tr v-for="component in subComponentCycleRows" :key="component._id">
                  <td class="text-body-2 assembly-name-cell">
                    <div class="sub-component-name-block">
                      <span class="sub-component-name-row">
                        <span class="sub-component-name">{{ component.part }}</span>
                        <v-btn
                          color="primary"
                          density="comfortable"
                          icon="mdi-open-in-app"
                          size="x-small"
                          variant="text"
                          @click="openSubComponent(component.partId)"
                        />
                      </span>
                      <span class="sub-component-description text-medium-emphasis">
                        {{ component.description }}
                      </span>
                    </div>
                  </td>
                  <td class="text-body-2 text-medium-emphasis assembly-meta-cell">
                    {{ component.operationCount }}
                    operation(s) x {{ component.qty }}
                  </td>
                  <td class="text-right assembly-chip-cell">
                    <v-chip class="my-2" color="primary" size="small" variant="tonal">
                      {{ formatCycleLonghand(component.totalCycleTime) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </template>

      <div class="routing-heading mb-2">
        <span class="font-weight-bold">{{
          hasSubComponents ? 'Assembly Routing' : 'Routing'
        }}</span>
        <span v-if="routingEntries.length" class="text-body-2 text-medium-emphasis">
          {{ routingSummary }}
        </span>
      </div>
      <div class="routing-list">
        <draggable
          v-if="routingEntries.length"
          v-model="routingEntries"
          drag-class="routing-row--dragging"
          ghost-class="routing-row--ghost"
          handle=".routing-drag-handle"
          item-key="rowId"
        >
          <template #item="{ element, index }">
            <div class="routing-row">
              <div class="routing-row__op">
                <v-icon class="routing-drag-handle" icon="mdi-drag" size="small" />
                <span class="routing-row__op-number">{{
                  formatRoutingOp(element.operation.op)
                }}</span>
              </div>
              <v-text-field
                v-model="element.operation.operation"
                class="routing-row__name"
                hide-details
                label="Operation"
              />
              <v-select
                v-model="element.operation.department"
                class="routing-row__department"
                :error="!element.operation.department"
                hide-details
                :items="departmentOptions"
                label="Department"
              />
              <v-text-field
                class="routing-row__time"
                :disabled="element.operation.noCycleTime"
                hide-details
                label="Cycle Time"
                :model-value="
                  element.operation.noCycleTime
                    ? 'None'
                    : getCycleInputValue(element.rowId, element.operation.time)
                "
                placeholder="m:ss"
                @blur="onCycleBlur(element.rowId, index)"
                @focus="onCycleFocus(element.rowId, element.operation.time)"
                @keydown.enter.prevent="onCycleBlur(element.rowId, index)"
                @update:model-value="onCycleInput(element.rowId, $event)"
              />
              <v-btn
                :aria-pressed="Boolean(element.operation.noCycleTime)"
                class="routing-row__action routing-row__no-time"
                :color="element.operation.noCycleTime ? 'warning' : undefined"
                density="comfortable"
                :icon="element.operation.noCycleTime ? 'mdi-clock-minus-outline' : 'mdi-clock-outline'"
                :title="
                  element.operation.noCycleTime
                    ? 'No cycle time: op is not costed. Click to give it a cycle time.'
                    : 'Timed op. Click to mark it as having no cycle time (inspection, deburr, outside process...).'
                "
                :variant="element.operation.noCycleTime ? 'tonal' : 'text'"
                @click="setNoCycleTime(element.rowId, index, !element.operation.noCycleTime)"
              />
              <v-btn
                class="routing-row__action routing-row__delete"
                color="red"
                density="comfortable"
                icon="mdi-delete-circle"
                title="Remove Operation"
                variant="text"
                @click="removeRoutingOperation(element.rowId, index)"
              />
            </div>
          </template>
        </draggable>
      </div>
      <v-btn class="mt-2" color="primary" variant="outlined" @click="addRoutingOperation">
        <v-icon icon="mdi-plus" left />Add Operation
      </v-btn>

      <v-divider class="my-4" />

      <v-expansion-panels class="mb-2">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <span class="font-weight-bold">Additional Costs</span>
            <template #actions>
              <span class="text-medium-emphasis mr-2">
                {{
                  additionalCostEntries.length
                    ? `${additionalCostEntries.length} item${additionalCostEntries.length > 1 ? 's' : ''} — $${formatCost(totalAdditionalCost)}`
                    : 'None'
                }}
              </span>
              <v-icon icon="mdi-chevron-down" />
            </template>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row
              v-for="entry in additionalCostEntries"
              :key="entry.rowId"
              class="mb-1 align-center"
              no-gutters
            >
              <v-col cols="12">
                <v-row class="mb-1" no-gutters>
                  <v-col cols="8">
                    <v-text-field
                      v-model="entry.item.name"
                      :append-inner-icon="entry.item.url ? 'mdi-open-in-new' : undefined"
                      class="mr-1"
                      dense
                      hide-details
                      label="Name"
                      @click:append-inner="openAdditionalCostLink(entry.item.url)"
                    />
                  </v-col>
                  <v-col cols="3">
                    <v-text-field
                      class="ml-1 mr-2"
                      dense
                      hide-details
                      inputmode="decimal"
                      label="Cost (ea)"
                      min="0"
                      :model-value="costInputs[entry.rowId] ?? formatCost(entry.item.cost)"
                      prefix="$"
                      type="text"
                      @blur="onCostBlur(entry.rowId, entry.idx)"
                      @focus="costInputs[entry.rowId] = entry.item.cost ? formatCost(entry.item.cost) : ''"
                      @keydown="onlyAllowNumeric($event)"
                      @update:model-value="onAdditionalCostsUpdate($event, entry.rowId, entry.idx)"
                    />
                  </v-col>
                  <v-col class="d-flex align-center justify-end ga-0" cols="1">
                    <v-btn
                      class="ma-0 pa-0 mr-1"
                      color="secondary"
                      density="compact"
                      icon
                      size="22"
                      :title="entry.item.url ? 'Edit Link' : 'Add Link'"
                      variant="text"
                      @click="openLinkDialog(entry.idx)"
                    >
                      <v-icon :icon="entry.item.url ? 'mdi-link-edit' : 'mdi-link-plus'" />
                    </v-btn>
                    <v-btn
                      class="ma-0 pa-0 ml-1"
                      color="error"
                      density="compact"
                      icon
                      size="22"
                      title="Remove Cost"
                      variant="text"
                      @click="removeAdditionalCost(entry.idx)"
                    >
                      <v-icon icon="mdi-delete-circle" />
                    </v-btn>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
            <v-btn color="primary" variant="outlined" @click="addAdditionalCost">
              <v-icon icon="mdi-plus" left />Add Cost
            </v-btn>

            <v-dialog v-model="linkDialogOpen" max-width="600">
              <v-card>
                <v-card-title>Purchase Link</v-card-title>
                <v-card-text>
                  <div v-if="activeAdditionalCostName" class="text-medium-emphasis mb-2">
                    Additional Cost: {{ activeAdditionalCostName }}
                  </div>
                  <v-text-field
                    v-model="linkInput"
                    clearable
                    label="URL"
                    placeholder="https://example.com"
                  />
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn variant="text" @click="closeLinkDialog">Cancel</v-btn>
                  <v-btn color="primary" variant="flat" @click="saveLinkDialog">Save</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-col>

    <v-col cols="12" lg="4" md="5">
      <v-sheet border class="pa-4 rounded-lg mb-6">
        <div class="text-subtitle-1 font-weight-bold mb-3">Summary & Details</div>

        <div class="summary-row mb-2">
          <span>Total Cycle Time</span>
          <b>{{ formatCycleLonghand(effectiveTotalCycleTime) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>
            Estimated Material Cost
            <v-chip
              v-if="part.customerSuppliedMaterial"
              :color="part.customerSuppliedMaterial ? 'info' : 'default'"
              size="x-small"
              variant="tonal"
            >
              Customer Supplied
            </v-chip>
          </span>
          <b>${{ formatCost(partMaterialCost) }}</b>
        </div>
        <div v-if="totalAdditionalCost" class="summary-row mb-2">
          <span>Additional Costs</span>
          <b>${{ formatCost(totalAdditionalCost) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Amount Minus Total Costs</span>
          <b>${{ formatCost(amountMinusTotalCosts) }}</b>
        </div>
        <div class="summary-row mb-4">
          <span>Current Rate</span>
          <b :class="`text-${currentRateTone}`"> ${{ formatCost(currentRate) }}/hr </b>
        </div>

        <v-divider class="mb-4" />

        <div class="text-subtitle-2 font-weight-bold mb-2">Target Rate $/hr</div>
        <div class="d-flex justify-space-between align-center mb-2">
          <span class="text-medium-emphasis">Target</span>
          <v-chip :color="targetVisualTone" size="small" variant="flat"
            >${{ formatCost(targetHourlyRate) }}/hr</v-chip
          >
        </div>

        <div class="target-slider-wrap mb-3">
          <div
            class="current-rate-indicator"
            :class="`text-${currentRateTone}`"
            :style="{ left: `calc(10px + (100% - 20px) * ${currentRateSliderPercent / 100})` }"
          >
            <span class="current-rate-label">Current</span>
            <div class="current-rate-arrow" />
          </div>

          <v-slider
            v-model="targetHourlyRate"
            class="target-slider rate-threshold-slider"
            color="primary"
            :max="hourlyTargetMax"
            :min="hourlyTargetMin"
            :step="hourlyTargetStep"
            :style="rateSliderStyle"
            thumb-label
          />

          <div class="slider-limits mb-6">
            <span>
              {{
                currentRate < hourlyTargetMin
                  ? `$${formatCost(currentRate)}/hr`
                  : `$${hourlyTargetMin}/hr`
              }}
            </span>
            <span>
              {{
                currentRate > hourlyTargetMax
                  ? `$${formatCost(currentRate)}/hr`
                  : `$${hourlyTargetMax}/hr`
              }}
            </span>
          </div>
        </div>

        <div class="summary-row mb-2">
          <span>Required Amount Minus Costs</span>
          <b>${{ formatCost(requiredAmountMinusCostsAtTarget) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Equivalent Product Price</span>
          <b>${{ formatCost(requiredProductPriceAtTarget) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Price Adjustment Needed</span>
          <b :class="priceDeltaToTarget >= 0 ? 'text-rateOk' : 'text-rateLow'">
            {{ priceDeltaToTarget >= 0 ? '+' : '-' }}${{ formatCost(Math.abs(priceDeltaToTarget)) }}
            <span class="text-medium-emphasis">({{ priceDeltaPercentLabel }})</span>
          </b>
        </div>
        <div class="summary-row">
          <span>Cycle Time Change Needed</span>
          <b :class="cycleTimeDeltaToTarget >= 0 ? 'text-rateLow' : 'text-rateOk'">
            {{
              `${cycleTimeDeltaToTarget >= 0 ? '-' : '+'}${formatCycle(Math.abs(cycleTimeDeltaToTarget))}`
            }}
            <span class="text-medium-emphasis">({{ formatCycle(requiredCycleTimeAtTarget) }})</span>
          </b>
        </div>
      </v-sheet>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { formatRoutingOp, ROUTING_OTHER_DEPARTMENT, routingOpNumber } from '@repo/utilities/parts';
import { computed, onMounted, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import { fetchDepartments } from '@/lib/machineDepartments';
import {
  buildRateThresholdGradient,
  getToneForRate,
  RATE_TARGET_RANGE,
} from '@/plugins/rates_theme';
import {
  calculateAssemblyCycleMinutes,
  calculatePartShopRate,
  calculateTotalCycleMinutes,
  formatCost,
  formatCycle,
  formatCycleLonghand,
  onlyAllowNumeric,
  parseCycle,
} from '@/plugins/utils';
import { toastError } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { usePartStore } from '@/stores/parts_store';

const { part, partMaterialCost, subComponents } = defineProps<{
  part: Part;
  partMaterialCost: number;
  subComponents?: Array<{
    key: string;
    entry: PartSubComponent;
    part: Part;
  }>;
}>();
const partStore = usePartStore();

// Routing

type RoutingEntry = {
  operation: RoutingOperation;
  idx: number;
  rowId: string;
};

const cycleTimeInputs = ref<Record<string, string>>({});
const editingCycleInputs = ref<Record<string, boolean>>({});
const routingRowIds = ref<string[]>([]);
const departments = ref<Department[]>([]);
let nextRoutingRowId = 0;

onMounted(async () => {
  try {
    departments.value = await fetchDepartments();
  } catch {
    toastError('Unable to load departments.');
  }
});

const departmentOptions = computed(() => [
  ...departments.value.map((department) => ({ title: department.name, value: department._id })),
  { title: 'Other', value: ROUTING_OTHER_DEPARTMENT },
]);

// Op numbers always follow row order: OP10, OP20, OP30...
function renumberRoutingInPlace() {
  (part.routing || []).forEach((operation, index) => {
    const op = routingOpNumber(index);
    if (operation.op !== op) operation.op = op;
  });
}

const routingEntries = computed<RoutingEntry[]>({
  get: () =>
    (part.routing || []).map((operation, idx) => ({
      operation,
      idx,
      rowId: routingRowIds.value[idx] ?? `routing-missing-${idx}`,
    })),
  set: (entries) => {
    part.routing = entries.map((entry) => entry.operation);
    routingRowIds.value = entries.map((entry) => entry.rowId);
    renumberRoutingInPlace();
  },
});

const routingSummary = computed(() => {
  const operations = part.routing || [];
  const untimedCount = operations.filter((operation) => operation.noCycleTime).length;
  const count = `${operations.length} op${operations.length === 1 ? '' : 's'}`;
  return untimedCount ? `${count}, ${untimedCount} without cycle time` : count;
});

const hasSubComponents = computed(() => (subComponents || []).length > 0);
const subComponentById = computed(() => {
  return new Map(partStore.parts.map((component) => [component._id, component]));
});
function resolvePart(partId: string) {
  return subComponentById.value.get(partId);
}
const subComponentCycleRows = computed(() => {
  return (subComponents || []).map((subComponent) => ({
    _id: subComponent.key,
    partId: subComponent.part._id,
    qty: Math.max(1, Number(subComponent.entry.qty) || 1),
    part: subComponent.part.part,
    description: subComponent.part.description,
    operationCount: (subComponent.part.routing || []).length,
    totalCycleTime:
      calculateAssemblyCycleMinutes(subComponent.part, resolvePart) *
      Math.max(1, Number(subComponent.entry.qty) || 1),
  }));
});
const effectiveTotalCycleTime = computed(() => {
  if (hasSubComponents.value) {
    return subComponentCycleRows.value.reduce(
      (total, component) => total + component.totalCycleTime,
      calculateTotalCycleMinutes(part.routing),
    );
  }

  return calculateAssemblyCycleMinutes(part, resolvePart);
});

const createRoutingRowId = () => `routing-${nextRoutingRowId++}`;

const syncRoutingRowIds = (count: number) => {
  while (routingRowIds.value.length < count) {
    routingRowIds.value.push(createRoutingRowId());
  }

  if (routingRowIds.value.length > count) {
    routingRowIds.value.splice(count);
  }
};

watch(
  () => part.routing?.length ?? 0,
  (count) => {
    syncRoutingRowIds(count);
  },
  { immediate: true },
);

const getCycleInputValue = (rowId: string, cycleTime: number) => {
  if (editingCycleInputs.value[rowId]) {
    return cycleTimeInputs.value[rowId] ?? formatCycle(cycleTime);
  }

  return formatCycle(cycleTime);
};

const onCycleFocus = (rowId: string, cycleTime: number) => {
  editingCycleInputs.value[rowId] = true;

  if (formatCycle(cycleTime) === '0:00') {
    cycleTimeInputs.value[rowId] = '';
    return;
  }

  cycleTimeInputs.value[rowId] = formatCycle(cycleTime);
};

const onCycleInput = (rowId: string, value: string) => {
  editingCycleInputs.value[rowId] = true;
  cycleTimeInputs.value[rowId] = value;
};

const onCycleBlur = (rowId: string, idx: number) => {
  const operation = part.routing?.[idx];
  if (!operation || operation.noCycleTime) {
    editingCycleInputs.value[rowId] = false;
    return;
  }

  const parsed = parseCycle(cycleTimeInputs.value[rowId]);
  operation.time = parsed;
  cycleTimeInputs.value[rowId] = formatCycle(parsed);
  editingCycleInputs.value[rowId] = false;
};

const setNoCycleTime = (rowId: string, idx: number, noCycleTime: boolean) => {
  const operation = part.routing?.[idx];
  if (!operation) return;

  operation.noCycleTime = noCycleTime;
  if (noCycleTime) {
    operation.time = 0;
    delete cycleTimeInputs.value[rowId];
    editingCycleInputs.value[rowId] = false;
  }
};

const addRoutingOperation = () => {
  if (!part.routing) part.routing = [];

  part.routing.push({
    op: routingOpNumber(part.routing.length),
    operation: '',
    department: null,
    time: 0,
    noCycleTime: false,
  });
  routingRowIds.value.push(createRoutingRowId());
};

const removeRoutingOperation = (rowId: string, idx: number) => {
  part.routing.splice(idx, 1);
  routingRowIds.value.splice(idx, 1);
  delete cycleTimeInputs.value[rowId];
  delete editingCycleInputs.value[rowId];
  renumberRoutingInPlace();
};

// Pricing

const priceInput = ref<string | null>(null);
const targetHourlyRate = ref(125);
const hourlyTargetMin = RATE_TARGET_RANGE.min;
const hourlyTargetMax = RATE_TARGET_RANGE.max;
const hourlyTargetStep = RATE_TARGET_RANGE.step;

const totalCostBase = computed(() => (partMaterialCost || 0) + totalAdditionalCost.value);
const hasNoProductPrice = computed(() => part.price == null || part.price === 0);
const productPriceHint = computed(() => {
  if ((part.derived?.directParentCount || 0) <= 0) {
    return undefined;
  }

  return 'Optional for sub-components unless this part is sold as a stand-alone part.';
});

const amountMinusTotalCosts = computed(() => (part.price ? part.price - totalCostBase.value : 0));

const currentRate = computed(() => {
  if (hasNoProductPrice.value) return 0;
  return calculatePartShopRate(part.price, totalCostBase.value, effectiveTotalCycleTime.value);
});

const targetVisualTone = computed(() => getToneForRate(targetHourlyRate.value));

const currentRateTone = computed(() => getToneForRate(currentRate.value));

const requiredAmountMinusCostsAtTarget = computed(() => {
  if (!effectiveTotalCycleTime.value) {
    return 0;
  }

  return (targetHourlyRate.value * effectiveTotalCycleTime.value) / 60;
});

const requiredProductPriceAtTarget = computed(
  () => requiredAmountMinusCostsAtTarget.value + totalCostBase.value,
);

const priceDeltaToTarget = computed(() => requiredProductPriceAtTarget.value - (part.price || 0));

const priceDeltaPercentLabel = computed(() => {
  const basePrice = part.price || 0;
  if (basePrice <= 0) {
    return 'n/a';
  }

  const percent = (priceDeltaToTarget.value / basePrice) * 100;
  const sign = percent >= 0 ? '+' : '-';
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
});

const requiredCycleTimeAtTarget = computed(() => {
  if (!targetHourlyRate.value || amountMinusTotalCosts.value <= 0) {
    return 0;
  }

  return (amountMinusTotalCosts.value / targetHourlyRate.value) * 60;
});

const cycleTimeDeltaToTarget = computed(
  () => effectiveTotalCycleTime.value - requiredCycleTimeAtTarget.value,
);

const currentRateSliderPercent = computed(() => {
  const range = hourlyTargetMax - hourlyTargetMin;
  if (range <= 0) {
    return 0;
  }

  const normalized = ((currentRate.value - hourlyTargetMin) / range) * 100;

  return Math.max(0, Math.min(100, normalized));
});

const rateSliderStyle = computed(() => ({
  '--rate-threshold-gradient': buildRateThresholdGradient(hourlyTargetMin, hourlyTargetMax),
}));

function onPriceUpdate(value: string) {
  priceInput.value = value;
  part.price = Number(value) || 0;
}

function openSubComponent(partId: string) {
  router.push({ name: 'viewPart', params: { id: partId } });
}

const onPriceBlur = () => {
  part.price = Math.max(0, Number(priceInput.value) || 0);
  priceInput.value = null;
};

// Costs

const costInputs = ref<Record<string, string | null>>({});
const linkDialogOpen = ref(false);
const linkDialogIndex = ref<number | null>(null);
const linkInput = ref('');

const totalAdditionalCost = computed(() =>
  (part.additionalCosts || []).reduce((sum, item) => sum + (Number(item.cost) || 0), 0),
);

const additionalCostEntries = computed(() =>
  (part.additionalCosts || []).map((item, idx) => ({ item, idx, rowId: `ac-${idx}` })),
);

const activeAdditionalCostName = computed(() => {
  const idx = linkDialogIndex.value;
  if (idx == null) {
    return '';
  }

  return part.additionalCosts?.[idx]?.name || '';
});

const onCostBlur = (rowId: string, idx: number) => {
  if (!part.additionalCosts?.[idx]) return;
  part.additionalCosts[idx].cost = Math.max(0, Number(costInputs.value[rowId]) || 0);
  costInputs.value[rowId] = null;
};

const addAdditionalCost = () => {
  if (!part.additionalCosts) {
    part.additionalCosts = [];
  }
  part.additionalCosts.push({ name: '', cost: 0, url: '' });
};

const removeAdditionalCost = (idx: number) => {
  delete costInputs.value[`ac-${idx}`];
  part.additionalCosts.splice(idx, 1);
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const openLinkDialog = (idx: number) => {
  linkDialogIndex.value = idx;
  linkInput.value = part.additionalCosts?.[idx]?.url || '';
  linkDialogOpen.value = true;
};

const closeLinkDialog = () => {
  linkDialogOpen.value = false;
  linkDialogIndex.value = null;
  linkInput.value = '';
};

const saveLinkDialog = () => {
  const idx = linkDialogIndex.value;
  if (idx == null || !part.additionalCosts?.[idx]) {
    closeLinkDialog();
    return;
  }

  part.additionalCosts[idx].url = normalizeUrl(linkInput.value);
  closeLinkDialog();
};

const openAdditionalCostLink = (url: string | undefined) => {
  const normalized = normalizeUrl(url || '');
  if (!normalized) {
    return;
  }

  window.open(normalized, '_blank', 'noopener,noreferrer');
};

function onAdditionalCostsUpdate(value: string, rowId: string, idx: number) {
  costInputs.value[rowId] = value;
  if (part.additionalCosts[idx])
    part.additionalCosts[idx].cost = Math.max(0, Number(costInputs.value[rowId]) || 0);
}
</script>

<style>
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.assembly-name-col {
  width: auto;
}

.assembly-meta-col {
  width: 180px;
}

.assembly-chip-col {
  width: 140px;
}

.assembly-name-cell {
  padding-right: 1rem;
}

.assembly-meta-cell {
  white-space: nowrap;
  text-align: right;
  padding-right: 1rem;
}

.assembly-chip-cell {
  white-space: nowrap;
}

.sub-component-name-block {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.sub-component-name {
  font-weight: 500;
}

.sub-component-name-row {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.sub-component-description {
  font-size: 0.7rem;
}

.routing-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.routing-list {
  container-type: inline-size;
}

.routing-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 170px 128px auto auto;
  grid-template-areas: "op name department time no-time delete";
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.routing-row__op {
  grid-area: op;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.routing-row__op-number {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.routing-row__name {
  grid-area: name;
}

.routing-row__department {
  grid-area: department;
}

.routing-row__time {
  grid-area: time;
}

/* Neutral circle behind the row's icon buttons; the clock's warning tonal style overrides it. */
.routing-row__action.v-btn--variant-text {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

.routing-row__no-time {
  grid-area: no-time;
  justify-self: center;
}

.routing-row__delete {
  grid-area: delete;
  justify-self: center;
}

/* Narrow editors: operation name gets its own line, the rest wraps beneath it. */
@container (max-width: 640px) {
  .routing-row {
    grid-template-columns: 76px minmax(0, 1fr) 128px auto auto;
    grid-template-areas:
      "op name name name delete"
      ". department time no-time no-time";
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
}

.routing-drag-handle {
  cursor: grab;
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.routing-drag-handle:active {
  cursor: grabbing;
}

.routing-row--ghost {
  opacity: 0.4;
}

.target-slider .v-slider-track {
  height: 10px;
}

.target-slider-wrap {
  position: relative;
  padding-top: 18px;
}

.current-rate-indicator {
  position: absolute;
  top: 0;
  width: 0;
  overflow: visible;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 1;
  pointer-events: none;
}

.current-rate-label {
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
  color: currentColor;
}

.current-rate-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid currentColor;
}

.slider-limits {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.5;
  margin-top: -30px;
  padding: 0 2px;
}

.target-slider .v-slider-track__fill {
  background: transparent;
  background-color: transparent;
  opacity: 0;
}
</style>
