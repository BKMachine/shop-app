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

const props = defineProps<{
  id: string;
  reorderThreshold: number;
}>();

const items = ref<AuditDoc[]>([] as AuditDoc[]);
const from = ref<DateTime>();
const to = ref<DateTime>();

onMounted(() => {
  to.value = DateTime.now();
  const diff = Duration.fromObject({ month: 3 });
  from.value = DateTime.now().minus(diff);
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

const stocks = computed<number[]>(() => {
  return filteredItems.value.map((x) => x.new.stock);
});

const labels = computed<string[]>(() => {
  return filteredItems.value.map((x) => {
    return DateTime.fromISO(x.timestamp).toLocaleString();
  });
});

Chart.register(...registerables);
Chart.register(annotationPlugin);

const chartData = computed<ChartData<'line'>>(() => {
  return {
    labels: labels.value,
    datasets: [
      {
        data: stocks.value,
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
