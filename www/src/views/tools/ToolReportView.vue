<template>
  <v-container>
    <div v-for="(item, i) in items" :key="item">
      <span class="bold">
        {{ item[0] }}
      </span>
      <v-divider />
      <div v-for="(tool, j) in item[1]" :key="tool._id">
        <span class="item"> {{ tool.item }} - Qty: {{ tool.reorderQty }} </span>
        <span class="line"> - </span>
        <span class="subtotal">{{ formatCost(tool.cost * tool.reorderQty) }}</span>
        <div v-if="j === item[1].length - 1" class="space"></div>
      </div>
    </div>
    <br />
    <div class="bold">Total: {{ formatCost(total) }}</div>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import axios from '@/plugins/axios';

const USDollar = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatCost(cost: number) {
  return USDollar.format(cost);
}
const tools = ref<ToolDocProp[]>([]);
const items = computed(() => {
  const brands = new Set(
    tools.value
      .map((x) => x._vendor?.name)
      .sort((a, b) => {
        const c = a.toLowerCase();
        const d = b.toLowerCase();
        if (c < d) return -1;
        else if (d < c) return 1;
        else return 0;
      }),
  );
  const main = [];
  brands.forEach((brand) => {
    const matches = tools.value
      .filter((x) => x._vendor?.name.toLowerCase() === brand.toLowerCase())
      .sort((a, b) => {
        const c = a.item?.toLowerCase();
        const d = b.item?.toLowerCase();
        if (c < d) return -1;
        else if (d < c) return 1;
        else return 0;
      });
    main.push([brand, matches]);
  });
  return main;
});

const total = computed(() => {
  return tools.value.reduce((a, b) => {
    const qty = b.reorderQty || 0;
    const cost = b.cost || 0;
    return qty * cost + a;
  }, 0);
});
onMounted(() => {
  tools.value = [];
  axios.get('/tools/reorders').then(({ data }) => {
    tools.value = data;
  });
});
</script>

<style scoped>
.bold {
  font-weight: bolder;
}
.space {
  height: 20px;
}
.line {
  width: 100%;
}
</style>
