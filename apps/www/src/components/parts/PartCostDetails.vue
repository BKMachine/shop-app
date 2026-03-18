<template>
  <v-row>
    <v-col cols="12" md="7">
      <v-row no-gutters>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="part.price"
            label="Product Price (Customer)"
            min="0"
            prefix="$"
            type="number"
          />
        </v-col>
      </v-row>

      <v-divider class="my-1" />
      <div class="mb-2 font-weight-bold">Cycle Times</div>
      <v-row v-for="entry in cycleEntries" :key="entry.rowId" class="mb-2 align-center">
        <v-col cols="10">
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="entry.cycle.operation"
                dense
                hide-details
                label="Operation Name"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
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
        <v-col cols="2">
          <v-icon
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
      <div class="mb-2 font-weight-bold">Summary & Details</div>
      <div class="mb-2"><b>Total Cycle Time:</b> {{ formatCycle(totalCycleTime) }}</div>
      <div class="mb-2"><b>Estimated Material Cost:</b> ${{ formatCost(partMaterialCost) }}</div>
      <div class="mb-2"><b>Estimated Profit:</b> ${{ formatCost(estimatedProfit) }}</div>
      <div class="mb-4"><b>Current Profit $/hr:</b> ${{ formatCost(currentProfitPerHour) }}</div>

      <div class="font-weight-bold mb-2">Required Product Price for Target $/hr</div>
      <div v-for="target in hourlyTargets" :key="target" class="mb-1">
        <b>${{ target }}/hr:</b>
        ${{ formatCost(requiredPriceForTarget(target)) }}
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatCost, formatCycle, parseCycle } from '@/plugins/utils';

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

const estimatedProfit = computed(() => (part.price ? part.price - (partMaterialCost || 0) : 0));

const currentProfitPerHour = computed(() => {
  if (!totalCycleTime.value) {
    return 0;
  }
  return estimatedProfit.value / (totalCycleTime.value / 60);
});

const hourlyTargets = [60, 100, 125];

const requiredPriceForTarget = (targetHourlyProfit: number) => {
  if (!totalCycleTime.value) {
    return partMaterialCost || 0;
  }
  return (partMaterialCost || 0) + (targetHourlyProfit * totalCycleTime.value) / 60;
};

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

<style scoped></style>
