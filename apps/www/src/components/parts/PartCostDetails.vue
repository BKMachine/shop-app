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
  <!-- <v-row v-for="(cycle, idx) in part.cycleTimes || []" :key="idx" class="mb-2">
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
  </v-row> -->
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
        ${{ (part.price && partMaterialCost) ? formatCost(part.price - partMaterialCost) : '0.00' }}
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatCost } from '@/plugins/utils';

const { part } = defineProps<{
  part: Part;
  partMaterialCost: number;
}>();

const totalCycleTime = computed(() =>
  (part.cycleTimes || []).reduce((total, cycle) => total + (cycle.time || 0), 0),
);
</script>

<style scoped></style>
