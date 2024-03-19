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

        <v-data-table
          v-model:page="page"
          :headers="headers"
          :items="items"
          :search="search"
          :loading="toolStore.loading"
          @click:row="openTool"
          @update:page="setPage"
          @update:items-per-page="setPage"
        >
          <template v-slot:[`item.img`]="{ item }">
            <v-img :src="item.img" class="tool-img"></v-img>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

defineProps<{
  title: string;
  headers: { key: string; title?: string }[];
  items: ToolDoc_Pop[];
}>();

const toolStore = useToolStore();
const search = ref('');
const page = ref(1);

function openTool(event: unknown, { item }: { item: ToolDoc }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}

function setPage() {
  if (!toolStore.tools.length) return;
  router.push({ name: 'tools', query: { page: page.value } });
}

onMounted(() => {
  getPage();
});

const loading = computed(() => toolStore.loading);
const query = computed(() => router.currentRoute.value.query);
watch(loading, () => {
  if (!loading.value) getPage();
});
watch(query, () => {
  getPage();
});

function getPage() {
  const p = router.currentRoute.value.query.page;
  const pageNum = parseInt(p as string) || 1;
  if (!isNaN(pageNum) && pageNum !== page.value) {
    page.value = pageNum;
  }
}
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
</style>
