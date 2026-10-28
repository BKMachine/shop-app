<template>
  <v-divider />
  <v-row class="mt-2 d-flex align-center" no-gutters>
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
import annotationPlugin, { type AnnotationOptions } from 'chartjs-plugin-annotation';
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
  reorderThreshold: number;
  currentStock: number;
  currentCost: number;
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
    .post('/audits/tools/stock', {
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

const data = computed<{ stock: GraphPoint[]; cost: GraphPoint[] }>(() => ({
  stock: stepPoints(items.value, from.value, to.value, props.currentStock || 0, (doc) => doc.stock),
  cost: stepPoints(items.value, from.value, to.value, props.currentCost || 0, (doc) => doc.cost),
}));

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
      } satisfies AnnotationOptions<'point'>;
    })
    .reduce<Record<string, AnnotationOptions<'point'>>>((annotations, value) => {
      annotations[`point${i++}`] = value;
      return annotations;
    }, {});
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
          label: (context) => {
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
      x: timeScale(from.value, to.value),
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
