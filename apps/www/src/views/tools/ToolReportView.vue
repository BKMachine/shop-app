<template>
  <v-container>
    <v-row>
      <v-spacer />
      <v-btn class="my-5" @click="mail">
        <v-icon icon="mdi-email-outline" />
      </v-btn>
    </v-row>
    <div v-for="(item, i) in items" :key="i">
      <span class="bold">
        {{ item[0] }}
      </span>
      <v-divider />
      <div v-for="(tool, j) in item[1]" :key="tool._id">
        <input type="checkbox" class="mr-2" :checked="tool.onOrder" @click="toggleOnOrder(tool)" />
        <span class="item"> {{ tool.item }} - Qty: {{ tool.reorderQty }} </span>
        <span class="line"> - </span>
        <span class="subtotal">{{ getCost(tool) }}</span>
        <span
          ><v-icon icon="mdi-open-in-app" size="16" class="ml-2" @click="open(tool)"></v-icon
        ></span>
        <div v-if="j === item[1].length - 1" class="space"></div>
      </div>
    </div>
    <br />
    <div class="bold">Total: {{ formatCost(total) }}</div>
    <div class="bold">Un-Ordered Total: {{ formatCost(unOrderedTotal) }}</div>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import axios from '@/plugins/axios';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const USDollar = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const tools = ref<Tool[]>([]);

function formatCost(cost: number): string {
  return USDollar.format(cost);
}

function getCost(tool: Tool): string {
  if (!tool.cost || !tool.reorderQty) return formatCost(0);
  return formatCost(tool.cost * tool.reorderQty);
}

type Item = [brand: string, matches: Tool[]];
const items = computed<Item[]>(() => {
  const brands: Set<string> = new Set(
    tools.value
      .map((x) => {
        return x.vendor && typeof x.vendor === 'object' ? x.vendor.name : 'No Brand';
      })
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
        const name = x.vendor && typeof x.vendor === 'object' ? x.vendor.name : 'No Brand';
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

const unOrderedTotal = computed(() => {
  return tools.value
    .filter((x) => !x.onOrder)
    .reduce((a, b) => {
      const qty = b.reorderQty || 0;
      const cost = b.cost || 0;
      return qty * cost + a;
    }, 0);
});

onMounted(() => {
  tools.value = [];
  axios.get('/tools/reorders').then(({ data }: { data: Tool[] }) => {
    tools.value = data;
  });
});

function toggleOnOrder(tool: Tool) {
  tool.onOrder = !tool.onOrder;
  toolStore.update(tool);
}

function open(tool: Tool) {
  router.push({ name: 'viewTool', params: { id: tool._id } });
}

function mail() {
  axios.get('/mail/reorders');
  // this.$toast.success('Email Sent', { position: 'bottom', duration: 3000 });
}
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
