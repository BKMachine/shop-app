<template>
  <v-card>
    <v-card-title>
      <div class="title">
        <img :src="tool._vendor?.logo" height="100px" alt="" class="mr-4" />
        {{ tool.item }} - {{ tool.stock }} in stock
      </div>
      <div>
        {{ tool.description }}
      </div>
    </v-card-title>
    <v-card-text class="card">
      <v-btn class="remove" @click="adjustStock(-1)">
        <v-icon size="100">mdi-export</v-icon>
      </v-btn>
      <v-btn class="add" @click="adjustStock(stockAdjustment)">
        <v-icon size="100">mdi-import</v-icon>
      </v-btn>
      <v-text-field v-model.number="stockAdjustment" type="number"></v-text-field>
      <v-btn class="details" @click="details">
        <v-icon size="100">mdi-file-document-outline</v-icon>
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  scanCode: string;
}>();
const emit = defineEmits(['close']);

const toolStore = useToolStore();
const stockAdjustment = ref(0);

const tool = computed(() => {
  return (toolStore.tools.find((x) => x.item === props.scanCode || x.barcode === props.scanCode) ||
    {}) as ToolDocProp;
});

async function adjustStock(num: number) {
  await toolStore.adjustStock(tool.value._id, num);
  stockAdjustment.value = 0;
  close();
}

function details() {
  close();
  router.push({ name: 'viewTool', params: { id: tool.value._id } });
}

function close() {
  emit('close');
}
</script>

<style scoped>
.card {
  padding: 20px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}
.card .v-btn {
  width: 200px;
  height: 200px;
  margin: 20px;
  border-radius: 20px;
}
.title {
  display: flex;
  align-items: center;
}
.remove:hover {
  background: red;
}
.add:hover {
  background: green;
}
.details:hover {
  background: blue;
}
</style>
