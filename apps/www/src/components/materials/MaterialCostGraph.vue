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
        :items="selectOptions"
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
import axios from '@/plugins/axios';
import 'chartjs-adapter-luxon';

Chart.register(...registerables);
Chart.register(annotationPlugin);

const props = defineProps<{
  id: string;
  currentCostPerFoot: number;
}>();

interface Select {
  title: string;
  value: number;
}

interface Data {
  x: number;
  y: number;
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
    .post('/audits/materials/cost', {
      id: props.id,
      from: from.value.toISO(),
      to: to.value.toISO(),
    })
    .then(({ data }: { data: Audit[] }) => {
      items.value = data;
    });
}

const data = computed<Data[]>(() => {
  const init: Data = { x: from.value.toMillis(), y: props.currentCostPerFoot || 0 };
  const last: Data = { x: to.value.toMillis(), y: props.currentCostPerFoot || 0 };

  if (!items.value.length) return [init, last];

  const startingDatum: Audit[] = [];
  const firstAudit = items.value[0];
  if (!firstAudit) return [init, last];

  const filtered = [...items.value].filter((item) => item.old.costPerFoot !== item.new.costPerFoot);

  firstAudit.timestamp = from.value.toISO() as string;
  if (!filtered[0] || firstAudit._id !== filtered[0]._id) startingDatum.push(firstAudit);

  const mappedData: Data[] = [...startingDatum, ...filtered].map((item) => {
    return {
      x: DateTime.fromISO(item.timestamp).toMillis(),
      y: Number(item.new.costPerFoot) || 0,
    };
  });

  return [...mappedData, last];
});

const chartData = computed<ChartData<'line'>>(() => {
  return {
    datasets: [
      {
        data: data.value,
        tension: 0,
        borderColor: '#ec5d0f',
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
      tooltip: {
        callbacks: {
          label: (context) => `Cost / ft: $${context.parsed.y?.toFixed(2)}`,
        },
      },
    },
    scales: {
      y: {
        display: true,
        title: {
          display: true,
          text: 'Cost / ft ($)',
        },
        min: 0,
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
