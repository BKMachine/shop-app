<template>
  <v-tabs v-model="tab" align-tabs="center" bg-color="primary" grow @update:model-value="onChange">
    <v-tab class="milling" value="milling"> Mill </v-tab>
    <v-tab class="turning" value="turning"> Lathe </v-tab>
    <v-tab class="swiss" value="swiss"> Swiss </v-tab>
    <v-tab class="other" value="other"> Misc </v-tab>
    <v-tab class="all" value="all"> All </v-tab>
  </v-tabs>

  <v-window v-model="tab" class="mt-3">
    <v-window-item value="milling">
      <ToolsDataTable
        v-if="tab === 'milling'"
        :category="tab"
        :headers="millingHeaders"
        :items="toolStore.millingTools"
        :search="search"
        title="Mill Department Tooling"
        @update-search="updateSearch"
      />
    </v-window-item>

    <v-window-item value="turning">
      <ToolsDataTable
        v-if="tab === 'turning'"
        :category="tab"
        :headers="turningHeaders"
        :items="toolStore.turningTools"
        :search="search"
        title="Lathe Department Tooling"
        @update-search="updateSearch"
      />
    </v-window-item>

    <v-window-item value="swiss">
      <ToolsDataTable
        v-if="tab === 'swiss'"
        :category="tab"
        :headers="turningHeaders"
        :items="toolStore.swissTools"
        :search="search"
        title="Swiss Department Tooling"
        @update-search="updateSearch"
      />
    </v-window-item>

    <v-window-item value="other">
      <ToolsDataTable
        v-if="tab === 'other'"
        :category="tab"
        :headers="otherHeaders"
        :items="toolStore.otherTools"
        :search="search"
        title="Miscellaneous Items"
        @update-search="updateSearch"
      />
    </v-window-item>

    <v-window-item value="all">
      <ToolsDataTable
        v-if="tab === 'all'"
        :category="tab"
        :headers="otherHeaders"
        :items="toolStore.tools"
        :search="search"
        title="All Items"
        @update-search="updateSearch"
      />
    </v-window-item>
  </v-window>
</template>

<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import ToolsDataTable from '@/components/ToolsDataTable.vue';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
const tab = ref<ToolCategory>('milling');
const search = ref<string>('');

onBeforeMount(() => {
  const type = window.localStorage.getItem('type');
  if (!type) window.localStorage.setItem('type', tab.value);
  else tab.value = type as ToolCategory;
});

function updateSearch(text: string) {
  search.value = text;
}

function onChange() {
  window.localStorage.setItem('type', tab.value);
  toolStore.setTabChange(true);
}

const millingHeaders = [
  {
    key: 'img',
    width: 150,
    sortable: false,
  },
  {
    title: 'Description',
    key: 'description',
  },
  {
    title: 'Vendor',
    key: 'vendor.name',
  },
  {
    title: 'Item',
    key: 'item',
  },
  {
    title: 'Coating',
    key: 'coating',
  },
  {
    title: 'Location',
    key: 'location',
  },
  {
    title: 'Stock',
    key: 'stock',
    align: 'center',
  },
];

const turningHeaders = [
  {
    key: 'img',
    width: 150,
    sortable: false,
  },
  {
    title: 'Description',
    key: 'description',
  },
  {
    title: 'Coating',
    key: 'coating',
  },
  {
    title: 'Vendor',
    key: 'vendor.name',
  },
  {
    title: 'Item',
    key: 'item',
  },
  {
    title: 'Cutting Edges',
    key: 'flutes',
  },
  {
    title: 'Location',
    key: 'location',
  },
];

const otherHeaders = [
  {
    key: 'img',
    width: 150,
    sortable: false,
  },
  {
    title: 'Description',
    key: 'description',
  },
  {
    title: 'Vendor',
    key: 'vendor.name',
  },
  {
    title: 'Item',
    key: 'item',
  },
  {
    title: 'Location',
    key: 'location',
  },
];
</script>

<style scoped></style>
