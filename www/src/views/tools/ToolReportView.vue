<template>
  <v-container>
    <div v-for="(item, i) in items" :key="i">
      <span class="bold">
        {{ item[0] }}
      </span>
      <v-divider />
      <div v-for="(tool, j) in item[1]" :key="tool._id">
        <span class="item"> {{ tool.item }} - Qty: {{ tool.reorderQty }} </span>
        <span class="line"> - </span>
        <span class="subtotal">{{ formatCost(getCost(tool)) }}</span>
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

function formatCost(cost: number): string {
  return USDollar.format(cost);
}

function getCost(tool: ToolDocPopulated): number {
  return (tool.cost as number) * (tool.reorderQty as number);
}

type Item = [brand: string, matches: ToolDocPopulated[]];

const tools = ref<ToolDocPopulated[]>([]);
const items = computed<Item[]>(() => {
  const brands: Set<string> = new Set(
    tools.value
      .map((x) => (typeof x.vendor === 'string' ? x.vendor : x.vendor?.name))
      .sort((a, b) => {
        const c = a.toLowerCase();
        const d = b.toLowerCase();
        if (c < d) return -1;
        else if (d < c) return 1;
        else return 0;
      }),
  );
  const main: Item[] = [];
  brands.forEach((brand) => {
    const matches = tools.value
      .filter((x) => {
        const name = typeof x.vendor === 'string' ? x.vendor : x.vendor?.name;
        return name.toLowerCase() === brand.toLowerCase();
      })
      .sort((a, b) => {
        const c = a.item?.toLowerCase() || 0;
        const d = b.item?.toLowerCase() || 0;
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
