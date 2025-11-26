<template>
  <v-tabs v-model="tab" align-tabs="center" grow bg-color="primary" @update:model-value="onChange">
    <v-tab value="milling" class="milling">Mill</v-tab>
    <v-tab value="turning" class="turning">Lathe</v-tab>
    <v-tab value="swiss" class="swiss">Swiss</v-tab>
    <v-tab value="other" class="other">Misc</v-tab>
  </v-tabs>

  <v-window v-model="tab" class="mt-3">
    <v-window-item value="milling">
      <ToolsDataTable
        v-if="tab === 'milling'"
        title="Mill Department Tooling"
        :headers="millingHeaders"
        :items="toolStore.millingTools"
        :category="tab"
        :search="search"
        @updateSearch="updateSearch"
      />
    </v-window-item>

    <v-window-item value="turning">
      <ToolsDataTable
        v-if="tab === 'turning'"
        title="Lathe Department Tooling"
        :headers="turningHeaders"
        :items="toolStore.turningTools"
        :category="tab"
        :search="search"
        @updateSearch="updateSearch"
      />
    </v-window-item>

    <v-window-item value="swiss">
      <ToolsDataTable
        v-if="tab === 'swiss'"
        title="Swiss Department Tooling"
        :headers="turningHeaders"
        :items="toolStore.swissTools"
        :category="tab"
        :search="search"
        @updateSearch="updateSearch"
      />
    </v-window-item>

    <v-window-item value="other">
      <ToolsDataTable
        v-if="tab === 'other'"
        title="Miscellaneous Items"
        :headers="otherHeaders"
        :items="toolStore.otherTools"
        :category="tab"
        :search="search"
        @updateSearch="updateSearch"
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
