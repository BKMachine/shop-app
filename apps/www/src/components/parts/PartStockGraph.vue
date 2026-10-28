<template>
  <v-divider />
  <v-row class="mt-5" no-gutters>
    <v-spacer />
    <v-col cols="3">
      <v-select
        v-model="months"
        class="ml-2"
        density="compact"
        item-title="title"
        item-value="value"
        :items="graphRanges"
        @update:model-value="getData"
      />
    </v-col>
  </v-row>
  <v-row class="container" no-gutters>
    <Line class="chart" :data="chartData" :options="options" />
  </v-row>
</template>

<script setup lang="ts">
import { Chart, type ChartData, type ChartOptions, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { DateTime } from 'luxon';
import { computed, onMounted, ref } from 'vue';
import { Line } from 'vue-chartjs';
import { type GraphPoint, graphRanges, stepPoints, timeScale } from '@/lib/auditGraph';
import axios from '@/plugins/axios';
import 'chartjs-adapter-luxon';

Chart.register(...registerables);
Chart.register(annotationPlugin);

const props = defineProps<{
  id: string;
  currentStock: number;
}>();

const months = ref<number>(1);
const items = ref<Audit[]>([] as Audit[]);
// The range of the audits in `items`, set when they arrive so the chart never mixes ranges.
const to = ref<DateTime>(DateTime.now());
const from = ref<DateTime>(to.value.minus({ months: months.value }));

onMounted(() => {
  setTimeout(getData, 100);
});

function getData() {
  const end = DateTime.now();
  const start = end.minus({ months: months.value });
  axios
    .post('/audits/parts/stock', {
      id: props.id,
      from: start.toISO(),
      to: end.toISO(),
    })
    .then(({ data }: { data: Audit[] }) => {
      items.value = data;
      from.value = start;
      to.value = end;
    });
}

const data = computed<GraphPoint[]>(() =>
  stepPoints(items.value, from.value, to.value, props.currentStock || 0, (doc) => doc.stock),
);

const chartData = computed<ChartData<'line'>>(() => {
  return {
    datasets: [
      {
        data: data.value,
        tension: 0,
        borderColor: '#54c0b9',
        stepped: true,
      },
    ],
  };
});

const options = computed<ChartOptions<'line'>>(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        display: true,
        title: {
          display: true,
          text: 'Stock #',
        },
        min: 0,
        suggestedMax: Math.max(100, props.currentStock + 20),
        ticks: {
          stepSize: 1,
        },
      },
      x: timeScale(from.value, to.value),
    },
    interaction: {
      intersect: false,
    },
  };
});
</script>

<style scoped>
.container {
  height: 200px;
  width: 100%;
  margin-bottom: 20px;
}
.chart {
  display: inline-block;
  height: 100%;
  width: 100%;
  position: relative;
}
</style>
