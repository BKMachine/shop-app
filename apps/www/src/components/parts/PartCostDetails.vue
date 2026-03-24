<template>
  <v-row>
    <v-col cols="12" md="7">
      <v-row no-gutters>
        <v-col cols="11">
          <v-text-field
            inputmode="decimal"
            label="Product Price"
            min="0"
            :model-value="priceInput ?? formatCost(part.price)"
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
      <div class="mb-2 font-weight-bold">Cycle Times</div>
      <v-row v-for="entry in cycleEntries" :key="entry.rowId" class="mb-2 align-center" no-gutters>
        <v-col cols="11">
          <v-row class="mb-2" no-gutters>
            <v-col cols="6">
              <v-text-field
                v-model="entry.cycle.operation"
                class="mr-1"
                dense
                hide-details
                label="Operation"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                class="ml-2"
                dense
                hide-details
                label="Cycle Time (mm:ss)"
                :model-value="getCycleInputValue(entry.rowId, entry.cycle.time)"
                @blur="onCycleBlur(entry.rowId, entry.idx)"
                @focus="onCycleFocus(entry.rowId, entry.cycle.time)"
                @update:model-value="onCycleInput(entry.rowId, $event)"
              />
            </v-col>
          </v-row>
        </v-col>
        <v-col cols="1">
          <v-icon
            class="ml-4"
            color="red"
            icon="mdi-delete-circle"
            size="x-large"
            @click="removeCycleTime(entry.rowId, entry.idx)"
          />
        </v-col>
      </v-row>
      <v-btn color="primary" variant="outlined" @click="addCycleTime">
        <v-icon left> mdi-plus </v-icon>Add Cycle Time
      </v-btn>

      <v-divider class="my-4" />

      <v-expansion-panels class="mb-2">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <span class="font-weight-bold">Additional Costs</span>
            <template #actions>
              <span class="text-medium-emphasis mr-2">
                {{ additionalCostEntries.length ? `${additionalCostEntries.length} item${additionalCostEntries.length > 1 ? 's' : ''} — $${formatCost(totalAdditionalCost)}` : 'None' }}
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
              <v-icon left>mdi-plus</v-icon>Add Cost
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

    <v-col cols="12" md="5">
      <v-sheet border class="pa-4 rounded-lg mb-6">
        <div class="text-subtitle-1 font-weight-bold mb-3">Summary & Details</div>

        <div class="summary-row mb-2">
          <span>Total Cycle Time</span>
          <b>{{ formatCycleLonghand(totalCycleTime) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Estimated Material Cost</span>
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
          <b :class="`text-${currentMarginTone}`">
            ${{ formatCost(currentAmountMinusMaterialPerHour) }}/hr
          </b>
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
            :class="`text-${currentMarginTone}`"
            :style="{ left: `${currentRateSliderPercent}%` }"
          >
            <span class="current-rate-label">Current</span>
            <div class="current-rate-arrow" />
          </div>

          <v-slider
            v-model="targetHourlyRate"
            class="target-slider"
            color="primary"
            :max="hourlyTargetMax"
            :min="hourlyTargetMin"
            :step="hourlyTargetStep"
            thumb-label
          />

          <div class="slider-limits mb-6">
            <span>${{ hourlyTargetMin }}/hr</span>
            <span>${{ hourlyTargetMax }}/hr</span>
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
            {{ `${cycleTimeDeltaToTarget >= 0 ? '-' : '+'}${formatCycle(Math.abs(cycleTimeDeltaToTarget))}` }}
            <span class="text-medium-emphasis">({{ formatCycle(requiredCycleTimeAtTarget) }})</span>
          </b>
        </div>
      </v-sheet>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  calculateRatePerHour,
  formatCost,
  formatCycle,
  formatCycleLonghand,
  getToneForRate,
  onlyAllowNumeric,
  parseCycle,
} from '@/plugins/utils';

const { part, partMaterialCost } = defineProps<{
  part: Part;
  partMaterialCost: number;
}>();

// Cycle Times

const cycleTimeInputs = ref<Record<string, string>>({});
const editingCycleInputs = ref<Record<string, boolean>>({});
const cycleRowIds = ref<string[]>([]);
let nextCycleRowId = 0;

const cycleEntries = computed(() =>
  (part.cycleTimes || []).map((cycle, idx) => ({
    cycle,
    idx,
    rowId: cycleRowIds.value[idx] ?? `cycle-missing-${idx}`,
  })),
);

const totalCycleTime = computed(() =>
  cycleEntries.value.reduce((total, entry) => {
    if (editingCycleInputs.value[entry.rowId]) {
      return total + parseCycle(cycleTimeInputs.value[entry.rowId]);
    }

    return total + (entry.cycle.time || 0);
  }, 0),
);

const createCycleRowId = () => `cycle-${nextCycleRowId++}`;

const syncCycleRowIds = (count: number) => {
  while (cycleRowIds.value.length < count) {
    cycleRowIds.value.push(createCycleRowId());
  }

  if (cycleRowIds.value.length > count) {
    cycleRowIds.value.splice(count);
  }
};

watch(
  () => part.cycleTimes?.length ?? 0,
  (count) => {
    syncCycleRowIds(count);
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
  if (!part.cycleTimes?.[idx]) {
    return;
  }

  const parsed = parseCycle(cycleTimeInputs.value[rowId]);
  part.cycleTimes[idx].time = parsed;
  cycleTimeInputs.value[rowId] = formatCycle(parsed);
  editingCycleInputs.value[rowId] = false;
};

const addCycleTime = () => {
  if (part.cycleTimes) {
    part.cycleTimes.push({ operation: '', time: 0 });
    const rowId = createCycleRowId();
    cycleRowIds.value.push(rowId);
    return;
  }

  part.cycleTimes = [{ operation: '', time: 0 }];
  const rowId = createCycleRowId();
  cycleRowIds.value = [rowId];
};

const removeCycleTime = (rowId: string, idx: number) => {
  part.cycleTimes.splice(idx, 1);
  cycleRowIds.value.splice(idx, 1);
  delete cycleTimeInputs.value[rowId];
  delete editingCycleInputs.value[rowId];
};

// Pricing

const priceInput = ref<string | null>(null);
const targetHourlyRate = ref(125);
const hourlyTargetMin = 50;
const hourlyTargetMax = 200;
const hourlyTargetStep = 5;

const totalCostBase = computed(() => (partMaterialCost || 0) + totalAdditionalCost.value);

const amountMinusTotalCosts = computed(() => (part.price ? part.price - totalCostBase.value : 0));

const currentAmountMinusMaterialPerHour = computed(() => {
  return calculateRatePerHour(part.price, totalCostBase.value, totalCycleTime.value);
});

const targetVisualTone = computed(() => getToneForRate(targetHourlyRate.value));

const currentMarginTone = computed(() => getToneForRate(currentAmountMinusMaterialPerHour.value));

const requiredAmountMinusCostsAtTarget = computed(() => {
  if (!totalCycleTime.value) {
    return 0;
  }

  return (targetHourlyRate.value * totalCycleTime.value) / 60;
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
  () => totalCycleTime.value - requiredCycleTimeAtTarget.value,
);

const currentRateSliderPercent = computed(() => {
  const range = hourlyTargetMax - hourlyTargetMin;
  if (range <= 0) {
    return 0;
  }

  const normalized = ((currentAmountMinusMaterialPerHour.value - hourlyTargetMin) / range) * 100;

  return Math.max(0, Math.min(100, normalized));
});

function onPriceUpdate(value: string) {
  priceInput.value = value;
  part.price = Number(value) || 0;
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
  transform: translateX(-50%);
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

.target-slider .v-slider-track__background {
  opacity: 1;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-rateLow)) 0%,
    rgb(var(--v-theme-rateLow)) 33.33%,
    rgb(var(--v-theme-rateWarn)) 33.33%,
    rgb(var(--v-theme-rateWarn)) 50%,
    rgb(var(--v-theme-rateOk)) 50%,
    rgb(var(--v-theme-rateOk)) 66.67%,
    rgb(var(--v-theme-rateGood)) 66.67%,
    rgb(var(--v-theme-rateGood)) 83.33%,
    rgb(var(--v-theme-rateTurbo)) 83.33%,
    rgb(var(--v-theme-rateTurbo)) 100%
  );
  background-color: transparent;
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
