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
        :cutting-dia="cuttingDia"
        :headers="millingHeaders"
        :items="toolStore.millingTools"
        :min-flute-length="minFluteLength"
        :search="search"
        title="Mill Department Tooling"
        :tool-type="toolType"
        @clear-all-filters="clearAllFilters"
        @update-cutting-dia="updateCuttingDia"
        @update-min-flute-length="updateMinFluteLength"
        @update-search="updateSearch"
        @update-tool-type="updateToolType"
      />
    </v-window-item>

    <v-window-item value="turning">
      <ToolsDataTable
        v-if="tab === 'turning'"
        :category="tab"
        :cutting-dia="cuttingDia"
        :headers="turningHeaders"
        :items="toolStore.turningTools"
        :min-flute-length="minFluteLength"
        :search="search"
        title="Lathe Department Tooling"
        :tool-type="toolType"
        @clear-all-filters="clearAllFilters"
        @update-cutting-dia="updateCuttingDia"
        @update-min-flute-length="updateMinFluteLength"
        @update-search="updateSearch"
        @update-tool-type="updateToolType"
      />
    </v-window-item>

    <v-window-item value="swiss">
      <ToolsDataTable
        v-if="tab === 'swiss'"
        :category="tab"
        :cutting-dia="cuttingDia"
        :headers="turningHeaders"
        :items="toolStore.swissTools"
        :min-flute-length="minFluteLength"
        :search="search"
        title="Swiss Department Tooling"
        :tool-type="toolType"
        @clear-all-filters="clearAllFilters"
        @update-cutting-dia="updateCuttingDia"
        @update-min-flute-length="updateMinFluteLength"
        @update-search="updateSearch"
        @update-tool-type="updateToolType"
      />
    </v-window-item>

    <v-window-item value="other">
      <ToolsDataTable
        v-if="tab === 'other'"
        :category="tab"
        :cutting-dia="cuttingDia"
        :headers="otherHeaders"
        :items="toolStore.otherTools"
        :min-flute-length="minFluteLength"
        :search="search"
        title="Miscellaneous Items"
        :tool-type="toolType"
        @clear-all-filters="clearAllFilters"
        @update-cutting-dia="updateCuttingDia"
        @update-min-flute-length="updateMinFluteLength"
        @update-search="updateSearch"
        @update-tool-type="updateToolType"
      />
    </v-window-item>

    <v-window-item value="all">
      <ToolsDataTable
        v-if="tab === 'all'"
        :category="tab"
        :cutting-dia="cuttingDia"
        :headers="otherHeaders"
        :items="toolStore.tools"
        :min-flute-length="minFluteLength"
        :search="search"
        title="All Items"
        :tool-type="toolType"
        @clear-all-filters="clearAllFilters"
        @update-cutting-dia="updateCuttingDia"
        @update-min-flute-length="updateMinFluteLength"
        @update-search="updateSearch"
        @update-tool-type="updateToolType"
      />
    </v-window-item>
  </v-window>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { type LocationQueryValue, useRoute } from 'vue-router';
import ToolsDataTable from '@/components/ToolsDataTable.vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
const route = useRoute();
const tab = ref<ToolCategory>('milling');
const search = ref<string>('');
const toolType = ref<string>('');
const cuttingDia = ref<string>('');
const minFluteLength = ref<string>('');
const FILTER_QUERY_KEYS = [
  'tab',
  'search',
  'toolType',
  'cuttingDia',
  'minFluteLength',
  'page',
] as const;

onBeforeMount(() => {
  applyRouteFilters();

  if (!firstQueryValue(route.query.tab)) {
    const type = window.localStorage.getItem('type');
    if (!type) window.localStorage.setItem('type', tab.value);
    else tab.value = type as ToolCategory;
  }
});

function updateSearch(text: string) {
  search.value = text;
  syncFiltersToQuery();
}

function updateToolType(value: string) {
  toolType.value = value;
  syncFiltersToQuery();
}

function updateCuttingDia(value: string) {
  cuttingDia.value = value;
  syncFiltersToQuery();
}

function updateMinFluteLength(value: string) {
  minFluteLength.value = value;
  syncFiltersToQuery();
}

function onChange(value: ToolCategory) {
  tab.value = value;
  window.localStorage.setItem('type', value);
  toolStore.setTabChange(true);
  syncFiltersToQuery();
}

watch(
  () => route.query,
  () => {
    applyRouteFilters();
  },
);

function applyRouteFilters() {
  const routeTab = firstQueryValue(route.query.tab);
  if (routeTab && isToolCategory(routeTab)) {
    tab.value = routeTab;
  }

  search.value = firstQueryValue(route.query.search) ?? '';
  toolType.value = firstQueryValue(route.query.toolType) ?? '';
  cuttingDia.value = firstQueryValue(route.query.cuttingDia) ?? '';
  minFluteLength.value = firstQueryValue(route.query.minFluteLength) ?? '';
}

function syncFiltersToQuery() {
  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !FILTER_QUERY_KEYS.includes(key as never)),
  );

  router.replace({
    query: {
      ...baseQuery,
      tab: tab.value,
      ...(search.value ? { search: search.value } : {}),
      ...(toolType.value && tab.value === 'milling' ? { toolType: toolType.value } : {}),
      ...(cuttingDia.value && tab.value === 'milling' ? { cuttingDia: cuttingDia.value } : {}),
      ...(minFluteLength.value && tab.value === 'milling'
        ? { minFluteLength: minFluteLength.value }
        : {}),
    },
  });
}

function clearAllFilters() {
  search.value = '';
  toolType.value = '';
  cuttingDia.value = '';
  minFluteLength.value = '';
  syncFiltersToQuery();
}

function firstQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue ?? undefined;
}

function isToolCategory(value: string): value is ToolCategory {
  return ['milling', 'turning', 'swiss', 'other', 'all'].includes(value);
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
