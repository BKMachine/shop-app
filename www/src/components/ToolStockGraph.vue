<template>
  <v-divider />
  <v-row no-gutters class="mt-5">
    <v-spacer />
    <v-col cols="3">
      <v-select
        v-model="months"
        class="ml-2"
        :items="selectOptions"
        item-title="title"
        item-value="value"
        density="compact"
        @update:modelValue="getData"
      />
    </v-col>
  </v-row>
  <v-row class="container" no-gutters>
    <Line :data="chartData" :options="options" class="chart" />
  </v-row>
</template>

<script setup lang="ts">
import { Chart, type ChartData, type ChartOptions, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { DateTime } from 'luxon';
import { computed, onMounted, ref } from 'vue';
import { Line } from 'vue-chartjs';
import axios from '@/plugins/axios';
import 'chartjs-adapter-luxon';

Chart.register(...registerables);
Chart.register(annotationPlugin);

const props = defineProps<{
  id: string;
  reorderThreshold: number;
  currentStock: number;
}>();

interface Select {
  title: string;
  value: number;
}

const selectOptions: Select[] = [
  { title: '1 month', value: 1 },
  { title: '3 months', value: 3 },
  { title: '6 months', value: 6 },
  { title: '1 year', value: 12 },
];
// Default to 1 month chart
const months = ref<number>(selectOptions[0].value);

const items = ref<AuditDoc[]>([] as AuditDoc[]);
const to = ref<DateTime>(DateTime.now());
const from = computed<DateTime>(() => DateTime.now().minus({ months: months.value }));

onMounted(() => {
  getData();
});

function getData() {
  axios
    .post('/audits/tools/stock', {
      id: props.id,
      from: from.value.toISO(),
      to: to.value.toISO(),
    })
    .then(({ data }: { data: AuditDoc[] }) => {
      items.value = data;
    });
}

interface Data {
  x: number;
  y: number;
}

const data = computed<Data[]>(() => {
  if (!items.value) return [];
  const filtered: Data[] = [...items.value]
    .filter((x) => x.old.stock && x.new.stock)
    .filter((x) => x.old.stock !== x.new.stock)
    .map((x) => {
      return { x: DateTime.fromISO(x.timestamp).toMillis(), y: x.new.stock };
    });
  if (!filtered.length) return [];
  const firstStock = filtered[0].y;
  const first: Data = { x: from.value.startOf('day').toMillis(), y: firstStock };
  const last: Data = { x: to.value.toMillis(), y: props.currentStock || 0 };
  return [first, ...filtered, last];
});

const orderPoints = computed(() => {
  let i = 1;
  return [...items.value]
    .filter((x) => !x.old.onOrder && x.new.onOrder)
    .map((x) => {
      return {
        type: 'point',
        xValue: DateTime.fromISO(x.timestamp).toMillis(),
        yValue: props.reorderThreshold,
        radius: 6,
        backgroundColor: 'rgba(151,255,99,0.5)',
      };
    })
    .reduce((a, v) => ({ ...a, [`point${i++}`]: v }), {});
});

const chartData = computed<ChartData<'line'>>(() => {
  return {
    datasets: [
      {
        data: data.value,
        tension: 0,
        //cubicInterpolationMode: 'monotone',
        borderColor: '#54c0b9',
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
      annotation: {
        annotations: {
          line1: {
            type: 'line',
            yMin: props.reorderThreshold,
            yMax: props.reorderThreshold,
            borderColor: 'rgb(216,60,60)',
            borderWidth: 1.0,
          },
          ...orderPoints.value,
        },
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
        suggestedMax: 6,
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        type: 'time',
        min: from.value.toMillis(),
        max: to.value.toMillis(),
        time: {
          tooltipFormat: 'D t',
          unit: 'day',
          displayFormats: {
            day: 'L/d',
          },
        },
        // clip: false,
      },
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
