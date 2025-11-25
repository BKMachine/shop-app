<template>
  <v-divider />
  <v-row no-gutters class="mt-2 d-flex align-center">
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
  currentCost: number;
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
    .post('/audits/tools/stock', {
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

const data = computed<{ stock: Data[]; cost: Data[] }>(() => {
  const stock: Data[] = [];
  const cost: Data[] = [];

  // If there are no audits just show a straight line at the current values
  const initStock: Data = { x: from.value.toMillis(), y: props.currentStock || 0 };
  const lastStock: Data = { x: to.value.toMillis(), y: props.currentStock || 0 };

  const initCost: Data = { x: from.value.toMillis(), y: props.currentCost || 0 };
  const lastCost: Data = { x: to.value.toMillis(), y: props.currentCost || 0 };
  if (!items.value || !items.value.length)
    return {
      stock: [initStock, lastStock],
      cost: [initCost, lastCost],
    };

  // Create a starting datum for when we started doing tool audits
  const startingDatumStock: Audit[] = [];
  const startingDatumCost: Audit[] = [];
  // Pull the first audit record from the results
  const firstAudit = items.value[0];

  // Filter for any audits with a stock number change
  const filteredStock = [...items.value].filter((x) => x.old.stock !== x.new.stock);
  const filteredCost = [...items.value].filter((x) => x.old.cost !== x.new.cost);

  // If the first audit is not in the filtered results add it to the starting datums array
  firstAudit.timestamp = from.value.toISO() as string;
  if (!filteredStock[0] || firstAudit._id !== filteredStock[0]._id)
    startingDatumStock.push(firstAudit);
  if (!filteredCost[0] || firstAudit._id !== filteredCost[0]._id)
    startingDatumCost.push(firstAudit);

  // Map the data the chart cares about
  const mappedStockData: Data[] = [...startingDatumStock, ...filteredStock].map((x) => {
    return { x: DateTime.fromISO(x.timestamp).toMillis(), y: x.new.stock };
  });
  const mappedCostData: Data[] = [...startingDatumCost, ...filteredCost].map((x) => {
    return { x: DateTime.fromISO(x.timestamp).toMillis(), y: x.new.cost };
  });

  console.log([...mappedCostData, lastCost]);
  return {
    stock: [...mappedStockData, lastStock],
    cost: [...mappedCostData, lastCost],
  };
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
        data: data.value.stock,
        tension: 0,
        borderColor: '#54c0b9',
        stepped: true,
        yAxisID: 'y',
      },
      {
        data: data.value.cost,
        tension: 0,
        borderColor: '#ec5d0f',
        borderWidth: 1.5,
        stepped: true,
        yAxisID: 'y1',
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
      tooltip: {
        callbacks: {
          label: function (context) {
            // If this is the cost dataset (yAxisID === 'y1'), add a $
            if (context.dataset.yAxisID === 'y1') {
              return `Cost: $${context.parsed.y}`;
            } else {
              return `Stock: ${context.parsed.y}`;
            }
          },
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
      y1: {
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Cost ($)',
        },
        grid: {
          drawOnChartArea: false,
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
        // clip: false,
      },
    },
    interaction: {
      mode: 'nearest',
      intersect: false,
      includeInvisible: true,
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
