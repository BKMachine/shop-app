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
        @update:model-value="getData"
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
const items = ref<Audit[]>([] as Audit[]);
const to = ref<DateTime>(DateTime.now());
const from = computed<DateTime>(() => DateTime.now().minus({ months: months.value }));

onMounted(() => {
  setTimeout(getData, 100);
});

function getData() {
  axios
    .post('/audits/parts/stock', {
      id: props.id,
      from: from.value.toISO(),
      to: to.value.toISO(),
    })
    .then(({ data }: { data: Audit[] }) => {
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
  const startingDatum: Audit[] = [];
  // Pull the first audit record from the results
  const firstAudit = items.value[0];
  if (!firstAudit) return [init, last];
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
