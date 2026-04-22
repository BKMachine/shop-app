<template>
  <div class="tools-view">
    <v-tabs
      v-model="tab"
      align-tabs="center"
      bg-color="primary"
      grow
      @update:model-value="onTabChange"
    >
      <v-tab class="milling" value="milling"> Mill </v-tab>
      <v-tab class="turning" value="turning"> Lathe </v-tab>
      <v-tab class="swiss" value="swiss"> Swiss </v-tab>
      <v-tab class="other" value="other"> Misc </v-tab>
      <v-tab class="all" value="all"> All </v-tab>
    </v-tabs>

    <ToolsTable
      :category="tab"
      class="tools-view__table mt-3"
      :cutting-dia="cuttingDia"
      :has-more="toolStore.hasMore"
      :headers="currentHeaders"
      :items="toolStore.tools"
      :loading-more="toolStore.loadingMore"
      :min-flute-length="minFluteLength"
      :order="order"
      :search="search"
      :sort-by="sortBy"
      :title="currentTitle"
      :tool-type="toolType"
      :total-items="toolStore.total"
      @clear-all-filters="clearAllFilters"
      @load-more="toolStore.fetchNextPage"
      @update-cutting-dia="updateCuttingDia"
      @update-min-flute-length="updateMinFluteLength"
      @update-search="updateSearch"
      @update-search-by="updateSearchBy"
      @update-tool-type="updateToolType"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ToolsTable from '@/components/tools/ToolsTable.vue';
import { useDocumentScrollLock } from '@/lib/useDocumentScrollLock';
import { isToolFilterCategory } from '@/plugins/toolCategories';
import { normalizeQueryValue } from '@/plugins/utils';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
const route = useRoute();

useDocumentScrollLock();

const tab = ref<ToolFilterCategory>('milling');
const search = ref<string>('');
const toolType = ref<string | null>(null);
const cuttingDia = ref<string>('');
const minFluteLength = ref<string>('');
const sortBy = ref<string>('');
const order = ref<'asc' | 'desc'>('asc');
const FILTER_QUERY_KEYS = [
  'tab',
  'search',
  'toolType',
  'cuttingDia',
  'minFluteLength',
  'sort',
  'order',
] as const;

function updateSearch(text: string) {
  search.value = text;
  syncFiltersToQuery();
}

function updateToolType(value: string | null) {
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

function onTabChange(value: ToolFilterCategory) {
  if (tab.value !== value) {
    toolType.value = null;
    if (value !== 'milling') {
      cuttingDia.value = '';
      minFluteLength.value = '';
    }
  }

  tab.value = value;
  window.localStorage.setItem('type', value);
  syncFiltersToQuery();
}

function updateSearchBy(value: { key: string; order: 'asc' | 'desc' }[]) {
  sortBy.value = value[0] ? value[0].key : '';
  order.value = value[0] ? value[0].order : 'asc';
  syncFiltersToQuery();
}

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    void fetchTools();
  },
  { immediate: true },
);

function applyRouteFilters() {
  const routeTab = normalizeQueryValue(route.query.tab);
  if (routeTab && isToolFilterCategory(routeTab)) {
    tab.value = routeTab;
  } else {
    const storedType = window.localStorage.getItem('type');
    if (storedType && isToolFilterCategory(storedType)) tab.value = storedType;
  }

  search.value = normalizeQueryValue(route.query.search) ?? '';
  toolType.value = normalizeQueryValue(route.query.toolType) ?? null;
  cuttingDia.value = normalizeQueryValue(route.query.cuttingDia) ?? '';
  minFluteLength.value = normalizeQueryValue(route.query.minFluteLength) ?? '';
  sortBy.value = normalizeQueryValue(route.query.sort) ?? '';
  order.value = normalizeQueryValue(route.query.order) === 'desc' ? 'desc' : 'asc';
}

async function fetchTools() {
  await toolStore.fetch({
    category: tab.value === 'all' ? undefined : tab.value,
    search: search.value || undefined,
    toolType: tab.value !== 'all' ? toolType.value || undefined : undefined,
    cuttingDia: tab.value === 'milling' ? cuttingDia.value || undefined : undefined,
    minFluteLength: tab.value === 'milling' ? minFluteLength.value || undefined : undefined,
    limit: 20,
    order: order.value || undefined,
    sort: sortBy.value || undefined,
  });
}

function syncFiltersToQuery() {
  // Preserve any existing query parameters that are not related to filters
  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !FILTER_QUERY_KEYS.includes(key as never)),
  );

  router.replace({
    query: {
      ...baseQuery,
      tab: tab.value,
      ...(search.value ? { search: search.value } : {}),
      ...(toolType.value && tab.value !== 'all' ? { toolType: toolType.value } : {}),
      ...(cuttingDia.value && tab.value === 'milling' ? { cuttingDia: cuttingDia.value } : {}),
      ...(minFluteLength.value && tab.value === 'milling'
        ? { minFluteLength: minFluteLength.value }
        : {}),
      ...(sortBy.value ? { sort: sortBy.value, order: order.value } : {}),
    },
  });
}

function clearAllFilters() {
  search.value = '';
  toolType.value = null;
  cuttingDia.value = '';
  minFluteLength.value = '';
  syncFiltersToQuery();
}

const currentHeaders = computed(() => {
  if (tab.value === 'milling') return millingHeaders;
  if (tab.value === 'turning' || tab.value === 'swiss') return turningHeaders;
  return otherHeaders;
});

const currentTitle = computed(() => {
  if (tab.value === 'milling') return 'Mill Department Tooling';
  if (tab.value === 'turning') return 'Lathe Department Tooling';
  if (tab.value === 'swiss') return 'Swiss Department Tooling';
  if (tab.value === 'other') return 'Miscellaneous Items';
  return 'All Items';
});

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

<style scoped>
.tools-view {
  height: calc(100dvh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tools-view__table {
  flex: 1;
  min-height: 0;
}
</style>
