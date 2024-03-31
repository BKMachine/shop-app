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
            variant="outlined"
            single-line
            hide-details
            clearable
          />
        </template>

        <v-data-table
          v-model:page="page"
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="items"
          :search="search"
          :loading="toolStore.loading"
          @click:row="openTool"
        >
          <template v-slot:[`item.img`]="{ item }">
            <v-img :id="item._id" :src="item.img" class="tool-img"></v-img>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
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
const itemsPerPage = ref(10);

function openTool(event: unknown, { item }: { item: ToolDoc }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}

watch(page, () => {
  if (page.value === 1) router.push({ name: 'tools' });
  else router.push({ name: 'tools', query: { page: page.value } });
});

watch(itemsPerPage, () => {
  localStorage.setItem('ipp', itemsPerPage.value.toString());
});

onMounted(() => {
  // Do items per page before page number
  const ipp = localStorage.getItem('ipp');
  if (ipp) {
    const ippNum = parseInt(ipp);
    if (!isNaN(ippNum)) itemsPerPage.value = ippNum;
  }

  const tabChanged = toolStore.tabChange;
  if (tabChanged) {
    router.push({ name: 'tools' });
    toolStore.setTabChange(false);
  } else {
    const query = router.currentRoute.value.query;
    if (query.page) {
      const pageNum = parseInt(query.page as string);
      if (!isNaN(pageNum)) page.value = pageNum;
    }
  }

  setTimeout(() => {
    if (toolStore.lastId) {
      const el = document.getElementById(toolStore.lastId);
      if (el) {
        const parent = el.parentElement?.parentElement;
        if (parent) {
          parent.classList.add('highlighted');
        }
      }
      toolStore.setLastId(null);
    }
  }, 150);
});
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
</style>

<style>
.highlighted {
  background: #efefef !important;
}
</style>
