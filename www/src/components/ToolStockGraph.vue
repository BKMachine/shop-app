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

const months = ref<number>(1);
const items = ref<AuditDoc[]>([] as AuditDoc[]);
const to = ref<DateTime>(DateTime.now());
const from = computed<DateTime>(() => DateTime.now().minus({ months: months.value }));

onMounted(() => {
  setTimeout(getData, 100);
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

const firstDate = DateTime.fromISO('2024-04-09T00:00:00-06:00');

const data = computed<Data[]>(() => {
  // If there are no audits just show a straight line at the current stock value
  const init: Data = { x: firstDate.toMillis(), y: props.currentStock || 0 };
  const last: Data = { x: to.value.toMillis(), y: props.currentStock || 0 };
  if (!items.value || !items.value.length) return [init, last];

  // Create a starting datum for when we started doing tool audits
  const startingDatum: AuditDoc[] = [];
  // Pull the first audit record from the results
  const firstAudit = items.value[0];
  // Filter for any audits with a stock number change
  const filtered = [...items.value].filter((x) => x.old.stock !== x.new.stock);
  // If the first audit is not in the filtered results add it to the starting datums array
  if (!filtered[0] || firstAudit._id !== filtered[0]._id) startingDatum.push(firstAudit);

  // Map the data the chart cares about
  const mappedData: Data[] = [...startingDatum, ...filtered].map((x) => {
    return { x: DateTime.fromISO(x.timestamp).toMillis(), y: x.new.stock };
  });

  return [...mappedData, last];
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
        suggestedMax: Math.max(6, props.reorderThreshold + 2),
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
