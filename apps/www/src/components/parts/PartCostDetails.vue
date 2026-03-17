<template>
  <v-row no-gutters>
    <v-col cols="4">
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
  <v-row v-for="(cycle, idx) in part.cycleTimes || []" :key="idx" class="mb-2">
    <v-col cols="5">
      <v-text-field v-model="cycle.operation" dense label="Operation Name" />
    </v-col>
    <v-col cols="5">
      <v-text-field
        v-model.number="cycle.time"
        dense
        label="Cycle Time (min)"
        min="0"
        type="number"
      />
    </v-col>
    <v-col cols="2">
      <v-btn color="red" icon @click="part.cycleTimes.splice(idx, 1)">
        <v-icon>mdi-delete</v-icon>
      </v-btn>
    </v-col>
  </v-row>
  <v-btn
    color="primary"
    variant="outlined"
    @click="part.cycleTimes ? part.cycleTimes.push({operation: '', time: 0}) : part.cycleTimes = [{operation: '', time: 0}]"
  >
    <v-icon left> mdi-plus </v-icon>Add Cycle Time
  </v-btn>
  <v-divider class="my-4" />
  <v-row>
    <v-col cols="4">
      <div><b>Total Cycle Time:</b> {{ totalCycleTime }} min</div>
    </v-col>
    <v-col cols="4">
      <div><b>Estimated Material Cost:</b> ${{ formatCost(partMaterialCost) }}</div>
    </v-col>
    <v-col cols="4">
      <div>
        <b>Estimated Profit:</b>
        ${{ (part.price && materialCost) ? formatCost(part.price - materialCost) : '0.00' }}
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatCost } from '@/plugins/utils';

const { part } = defineProps<{
  part: Part;
}>();

const totalCycleTime = computed(() =>
  (part.cycleTimes || []).reduce((total, cycle) => total + (cycle.time || 0), 0),
);

const materialCost = computed(() => {
  if (!part.material) return 0;
  if (typeof part.material === 'string') return 0;
  const feet = (part.material.length || 0) / 12;
  return feet * (part.material.costPerFoot || 0);
});

const partMaterialCost = computed(() => {
  if (!part.material || typeof part.material === 'string') return 0;

  const fullBarLength = part.material.length || 0;
  const materialLength = Number(part.materialLength) || 0;

  if (!fullBarLength || !materialLength) return 0;

  const cutType = part.materialCutType || 'blanks';

  let partsPerBar = 0;
  if (cutType !== 'bars') {
    partsPerBar = Math.floor(fullBarLength / materialLength);
  } else {
    const barLength = Number(part.barLength) || 0;
    const remnantLength = Number(part.remnantLength) || 0;
    if (barLength > 0 && barLength > remnantLength) {
      const subBars = Math.floor(fullBarLength / barLength);
      const remainderLength = fullBarLength % barLength;
      const usablePerSubBar = barLength - remnantLength;
      const partsPerSubBar = Math.floor(usablePerSubBar / materialLength);
      const usableRemainder = Math.max(remainderLength - remnantLength, 0);
      const remainderParts = Math.floor(usableRemainder / materialLength);
      partsPerBar = subBars * partsPerSubBar + remainderParts;
    }
  }

  if (!partsPerBar) return 0;
  return Math.round((materialCost.value / partsPerBar) * 100) / 100;
});
</script>

<style scoped></style>
