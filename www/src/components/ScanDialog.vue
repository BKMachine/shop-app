<template>
  <v-card>
    <v-card-title>{{ tool.item }} - {{ tool.stock }} in stock</v-card-title>
    <v-card-text class="card">
      <v-btn class="remove">
        <v-icon size="100">mdi-export</v-icon>
      </v-btn>
      <v-btn class="add">
        <v-icon size="100">mdi-import</v-icon>
      </v-btn>
      <v-btn class="details">
        <v-icon size="100">mdi-file-document-outline</v-icon>
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  scanCode: string;
}>();

const toolStore = useToolStore();

const tool = computed(() => {
  return toolStore.tools.find((x) => x.item === props.scanCode) || ({} as Tool);
});
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
