<template>
  <v-card>
    <v-card-title class="header">
      <div>{{ title }}</div>
      <div>
        <v-btn link :to="{ name: 'createTool' }" color="primary" prepend-icon="mdi-plus">
          Create New Tool
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-card flat>
        <template v-slot:text>
          <v-text-field
            v-model="search"
            label="Search"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
            hide-details
            clearable
          ></v-text-field>
        </template>

        <v-data-table-virtual
          :headers="headers"
          :items="items"
          :search="search"
          :loading="toolStore.loading"
          @click:row="openTool"
        >
          <template v-slot:[`item.img`]="{ item }">
            <v-img :src="item.img" class="tool-img"></v-img>
          </template>
        </v-data-table-virtual>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

defineProps<{
  title: string;
  headers: { key: string; title?: string }[];
  items: ToolDoc_Pop[];
}>();

const toolStore = useToolStore();
const search = ref('');

function openTool(event: unknown, { item }: { item: ToolDoc }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
</style>
