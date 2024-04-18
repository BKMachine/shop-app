<template>
  <div class="container">
    <LineChart :chart-data="chartData" :options="options" class="chart" />
  </div>
</template>

<script setup lang="ts">
import { Chart, type ChartData, type ChartOptions, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { DateTime, Duration } from 'luxon';
import { computed, onMounted, ref } from 'vue';
import { LineChart } from 'vue-chart-3';
import axios from '@/plugins/axios';
import 'chartjs-adapter-luxon';

const props = defineProps<{
  id: string;
  reorderThreshold: number;
}>();

const items = ref<AuditDoc[]>([] as AuditDoc[]);
const to = ref<DateTime>(DateTime.now());
const diff = Duration.fromObject({ month: 3 });
const from = ref<DateTime>(DateTime.now().minus(diff));

onMounted(() => {
  axios
    .post('/audits/tools/stock', {
      id: props.id,
      from: from.value.toISO(),
      to: to.value.toISO(),
    })
    .then(({ data }: { data: AuditDoc[] }) => {
      items.value = data;
    });
});

const filteredItems = computed(() => {
  return [...items.value].filter((x) => x.old.stock !== x.new.stock);
});

const data = computed<{ x: number; y: number }[]>(() => {
  return filteredItems.value.map((x) => {
    return { x: DateTime.fromISO(x.timestamp).toMillis(), y: x.new.stock };
  });
});

const orderPoints = computed(() => {
  let i = 1;
  const radius = 5;
  return [...items.value]
    .filter((x) => !x.old.onOrder && x.new.onOrder)
    .map((x) => {
      return {
        type: 'point',
        xValue: DateTime.fromISO(x.timestamp).toMillis(),
        yValue: props.reorderThreshold,
        backgroundColor: 'rgba(151,255,99,0.25)',
        radius,
        xAdjust: -(radius * 0.5) + 2,
      };
    })
    .reduce((a, v) => ({ ...a, [`point${i++}`]: v }), {});
});

Chart.register(...registerables);
Chart.register(annotationPlugin);

const chartData = computed<ChartData<'line'>>(() => {
  return {
    datasets: [
      {
        data: data.value,
        tension: 0.4,
        //cubicInterpolationMode: 'monotone',
        borderColor: '#54c0b9',
      },
    ],
  };
});

const options = computed<ChartOptions<'line'>>(() => {
  return {
    responsive: true,
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
        suggestedMax: 10,
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        type: 'timeseries',
        min: from.value.toMillis(),
        max: to.value.toMillis(),
        adapters: {
          date: {},
        },
        time: {
          unit: 'day',
          displayFormats: {
            day: 'L/d/yyyy',
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
