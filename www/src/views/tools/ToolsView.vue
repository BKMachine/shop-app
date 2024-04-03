<template>
  <v-tabs v-model="tab" align-tabs="center" grow bg-color="primary" @update:modelValue="onChange">
    <v-tab value="milling" class="milling">Milling</v-tab>
    <v-tab value="turning" class="turning">Turning</v-tab>
    <v-tab value="other" class="other">Other</v-tab>
  </v-tabs>

  <v-window v-model="tab" class="mt-3">
    <v-window-item value="milling">
      <ToolsDataTable
        v-if="tab === 'milling'"
        title="Milling Tools"
        :headers="millingHeaders"
        :items="toolStore.millingTools"
        :category="tab"
      />
    </v-window-item>

    <v-window-item value="turning">
      <ToolsDataTable
        v-if="tab === 'turning'"
        title="Turning Tools"
        :headers="turningHeaders"
        :items="toolStore.turningTools"
        :category="tab"
      />
    </v-window-item>

    <v-window-item value="other">
      <ToolsDataTable
        v-if="tab === 'other'"
        title="Other Tools"
        :headers="otherHeaders"
        :items="toolStore.otherTools"
        :category="tab"
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

onBeforeMount(() => {
  const type = window.localStorage.getItem('type');
  if (!type) window.localStorage.setItem('type', tab.value);
  else tab.value = type as ToolCategory;
});

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
    title: 'Flutes',
    key: 'flutes',
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
    title: 'Cutting Edges',
    key: 'flutes',
  },
  {
    title: 'Item',
    key: 'item',
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
];
</script>

<style scoped></style>
