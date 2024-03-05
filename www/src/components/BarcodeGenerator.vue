<template>
  <canvas id="canvas"></canvas>
</template>

<script setup lang="ts">
import JsBarcode from 'jsbarcode';
import { onMounted } from 'vue';

const props = defineProps<{
  code?: number | undefined;
  text?: string | undefined;
  showText: boolean;
}>();

onMounted(() => {
  const str = props.code !== undefined ? `BK_${props.code}` : props.text;
  if (!str) return;
  JsBarcode('#canvas', str, {
    width: 1,
    height: 10,
    displayValue: props.showText,
    background: 'rgba(255, 255, 255, 0)',
  });
});
</script>

<style scoped>
#canvas {
  background: rgba(0, 0, 0, 0);
}
</style>
