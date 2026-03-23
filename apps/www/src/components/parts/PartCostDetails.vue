<template>
  <v-row>
    <v-col cols="12" md="7">
      <v-row no-gutters>
        <v-col cols="11">
          <v-text-field
            v-model.number="part.price"
            label="Product Price"
            min="0"
            prefix="$"
            type="number"
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
                label="Operation Name"
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
    </v-col>

    <v-col cols="12" md="5">
      <v-sheet border class="pa-4 rounded-lg">
        <div class="text-subtitle-1 font-weight-bold mb-3">Summary & Details</div>

        <div class="summary-row mb-2">
          <span>Total Cycle Time</span>
          <b>{{ formatCycleLonghand(totalCycleTime) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Estimated Material Cost</span>
          <b>${{ formatCost(partMaterialCost) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Amount Minus Material Cost</span>
          <b>${{ formatCost(amountMinusMaterialCost) }}</b>
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
            >${{ targetHourlyRate }}/hr</v-chip
          >
        </div>

        <v-slider
          v-model="targetHourlyRate"
          class="mb-3 target-slider"
          color="primary"
          :max="hourlyTargetMax"
          :min="hourlyTargetMin"
          :step="hourlyTargetStep"
          thumb-label
        />

        <div class="summary-row mb-2">
          <span>Required Amount Minus Material</span>
          <b>${{ formatCost(requiredAmountMinusMaterialAtTarget) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Equivalent Product Price (Current Material)</span>
          <b>${{ formatCost(requiredProductPriceAtTarget) }}</b>
        </div>
        <div class="summary-row mb-2">
          <span>Price Adjustment Needed</span>
          <b :class="priceDeltaToTarget >= 0 ? 'text-success' : 'text-error'">
            {{ priceDeltaToTarget >= 0 ? '+' : '-' }}${{ formatCost(Math.abs(priceDeltaToTarget)) }}
          </b>
        </div>
        <div class="summary-row">
          <span>Cycle Time Change Needed</span>
          <b :class="cycleTimeDeltaToTarget >= 0 ? 'text-error' : 'text-success'">
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
  parseCycle,
} from '@/plugins/utils';

const { part, partMaterialCost } = defineProps<{
  part: Part;
  partMaterialCost: number;
}>();

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

const getEffectiveCycleTime = (rowId: string, cycleTime: number) => {
  if (editingCycleInputs.value[rowId]) {
    return parseCycle(cycleTimeInputs.value[rowId]);
  }

  return cycleTime || 0;
};

const totalCycleTime = computed(() =>
  cycleEntries.value.reduce(
    (total, entry) => total + getEffectiveCycleTime(entry.rowId, entry.cycle.time),
    0,
  ),
);

const amountMinusMaterialCost = computed(() =>
  part.price ? part.price - (partMaterialCost || 0) : 0,
);

const currentAmountMinusMaterialPerHour = computed(() => {
  return calculateRatePerHour(part.price, partMaterialCost || 0, totalCycleTime.value);
});

const hourlyTargetMin = 50;
const hourlyTargetMax = 200;
const hourlyTargetStep = 5;

const targetHourlyRate = ref(125);

const targetVisualTone = computed(() => getToneForRate(targetHourlyRate.value));

const currentMarginTone = computed(() => getToneForRate(currentAmountMinusMaterialPerHour.value));

const requiredAmountMinusMaterialAtTarget = computed(() => {
  if (!totalCycleTime.value) {
    return 0;
  }

  return (targetHourlyRate.value * totalCycleTime.value) / 60;
});

const requiredProductPriceAtTarget = computed(
  () => requiredAmountMinusMaterialAtTarget.value + (partMaterialCost || 0),
);

const priceDeltaToTarget = computed(() => requiredProductPriceAtTarget.value - (part.price || 0));

const requiredCycleTimeAtTarget = computed(() => {
  if (!targetHourlyRate.value || amountMinusMaterialCost.value <= 0) {
    return 0;
  }

  return (amountMinusMaterialCost.value / targetHourlyRate.value) * 60;
});

const cycleTimeDeltaToTarget = computed(
  () => totalCycleTime.value - requiredCycleTimeAtTarget.value,
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

const removeCycleTime = (rowId: string, idx: number) => {
  part.cycleTimes.splice(idx, 1);
  cycleRowIds.value.splice(idx, 1);
  delete cycleTimeInputs.value[rowId];
  delete editingCycleInputs.value[rowId];
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

.target-slider .v-slider-track__background {
  opacity: 1;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-error)) 0%,
    rgb(var(--v-theme-error)) 6.67%,
    rgb(var(--v-theme-warning)) 33.33%,
    rgb(var(--v-theme-success)) 50%,
    rgb(var(--v-theme-success)) 66.67%,
    rgb(var(--v-theme-info)) 83.33%,
    rgb(var(--v-theme-primary)) 100%
  );
  background-color: transparent;
}

.target-slider .v-slider-track__fill {
  background: transparent;
  background-color: transparent;
  opacity: 0;
}
</style>
