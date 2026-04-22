<template>
  <v-card class="infinite-scroll-view-card">
    <v-card-title class="header my-4 d-flex">
      Stock by Location
      <div v-if="totalResults && location">
        &nbsp;- {{ totalResults }} result{{ totalResults === 1 ? '' : 's' }}
      </div>
      <v-spacer />
    </v-card-title>
    <v-card-text class="tool-table-card-text infinite-scroll-view-card__body">
      <v-card class="locations-card" flat>
        <div class="locations-filters">
          <div class="location-filter-row">
            <div class="text-subtitle-2">Show</div>
            <v-chip-group v-model="sourceFilter" color="primary" mandatory>
              <v-chip filter value="all">All</v-chip>
              <v-chip filter value="parts">Parts</v-chip>
              <v-chip filter value="tools">Tools</v-chip>
            </v-chip-group>
          </div>

          <v-row>
            <v-col cols="6">
              <v-select v-model="location" clearable :items="locations" label="Location" />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="position"
                clearable
                :item-title="getPositionLabel"
                item-value="value"
                :items="positions"
                label="Position"
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" :title="getPositionOption(item).value">
                    <template #prepend>
                      <div class="position-source-icons">
                        <v-icon
                          v-if="getPositionOption(item).sources.includes('part')"
                          color="primary"
                          icon="mdi-shape-outline"
                          size="16"
                        />
                        <v-icon
                          v-if="getPositionOption(item).sources.includes('tool')"
                          color="secondary"
                          icon="mdi-tools"
                          size="16"
                        />
                      </div>
                    </template>
                  </v-list-item>
                </template>

                <template #selection="{ item }">
                  <div class="position-selection">
                    <div class="position-source-icons">
                      <v-icon
                        v-if="getPositionOption(item).sources.includes('part')"
                        color="primary"
                        icon="mdi-shape-outline"
                        size="16"
                      />
                      <v-icon
                        v-if="getPositionOption(item).sources.includes('tool')"
                        color="secondary"
                        icon="mdi-tools"
                        size="16"
                      />
                    </div>
                    <span>{{ getPositionOption(item).value }}</span>
                  </div>
                </template>

                <template #no-data>
                  <v-list-item>
                    <v-list-item-title v-if="!location">
                      Please select a location first
                    </v-list-item-title>
                    <v-list-item-title v-else>
                      No positions found for this location
                    </v-list-item-title>
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
          </v-row>
        </div>

        <InfiniteScrollDataTable
          v-if="location"
          ref="tableRef"
          class="locations-table"
          :has-more="hasMoreResults"
          :headers="headers"
          :items="inventoryRows"
          :loading="isLoadingResults"
          :loading-more="isLoadingMoreResults"
          :sort-by="sortBy"
          @click:row="openInventoryRow"
          @load-more="fetchInventory(true)"
          @update:sort-by="updateSortBy"
        >
          <template #['item.entityType']="{ item }">
            <div class="entity-type-cell">
              <v-icon
                :color="item.entityType === 'part' ? 'primary' : 'secondary'"
                :icon="item.entityType === 'part' ? 'mdi-shape-outline' : 'mdi-tools'"
                size="18"
              />
            </div>
          </template>

          <template #['item.img']="{ item }">
            <v-img v-if="item.img" class="tool-img" :src="item.img" />
            <MissingImage v-else class="tool-img tool-img-fallback" />
          </template>

          <template #['item.reference']="{ item }"> {{ item.reference }} </template>

          <template #['item.location']="{ item }"> {{ item.location || '' }} </template>

          <template #['item.position']="{ item }"> {{ item.position || '' }} </template>

          <template #['item.stock']="{ item }">
            <span class="stock">{{ item.stock }}</span>
          </template>
        </InfiniteScrollDataTable>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import InfiniteScrollDataTable from '@/components/InfiniteScrollDataTable.vue';
import MissingImage from '@/components/MissingImage.vue';
import { useDocumentScrollLock } from '@/lib/useDocumentScrollLock';
import api from '@/plugins/axios';
import { normalizeQueryValue } from '@/plugins/utils';
import router from '@/router';
import { usePartStore } from '@/stores/parts_store';
import { useToolStore } from '@/stores/tool_store';

type InventorySourceFilter = 'all' | 'parts' | 'tools';
type InventoryEntityType = 'part' | 'tool';

type PositionOption = {
  value: string;
  sources: InventoryEntityType[];
};

type InventoryRow = {
  _id: string;
  entityType: InventoryEntityType;
  img?: string;
  reference: string;
  description: string;
  location?: string | null;
  position?: string;
  stock: number;
};

const route = useRoute();
const partStore = usePartStore();
const toolStore = useToolStore();

useDocumentScrollLock();

const location = ref('');
const position = ref('');
const sourceFilter = ref<InventorySourceFilter>('all');
const sortBy = ref<Array<{ key: string; order: 'asc' | 'desc' }>>([
  { key: 'description', order: 'asc' },
]);
const itemsPerPage = ref(getStoredItemsPerPage());
const toolLocations = ref<string[]>([]);
const partLocations = ref<string[]>([]);
const rawPositionOptions = ref<PositionOption[]>([]);
const tableRef = ref<InstanceType<typeof InfiniteScrollDataTable> | null>(null);
const QUERY_KEYS = ['loc', 'pos', 'source', 'sort', 'order'] as const;

void fetchLocations();

const locations = computed(() => {
  if (sourceFilter.value === 'parts') return partLocations.value;
  if (sourceFilter.value === 'tools') return toolLocations.value;
  return mergeUniqueStrings([...toolLocations.value, ...partLocations.value]);
});

const positions = computed(() => {
  return rawPositionOptions.value.filter((option) => {
    if (sourceFilter.value === 'all') return true;
    const source = sourceFilter.value === 'parts' ? 'part' : 'tool';
    return option.sources.includes(source);
  });
});

const inventoryRows = computed<InventoryRow[]>(() => {
  const partRows =
    sourceFilter.value === 'tools'
      ? []
      : partStore.listParts.map((part) => ({
          _id: part._id,
          entityType: 'part' as const,
          img: part.img,
          reference: part.part,
          description: part.description,
          location: part.location,
          position: part.position,
          stock: part.stock,
        }));

  const toolRows =
    sourceFilter.value === 'parts'
      ? []
      : toolStore.tools.map((tool) => ({
          _id: tool._id,
          entityType: 'tool' as const,
          img: tool.img,
          reference: tool.item || '',
          description: tool.description,
          location: tool.location,
          position: tool.position,
          stock: tool.stock,
        }));

  const rows = [...partRows, ...toolRows];
  const activeSort = sortBy.value[0];

  if (!activeSort) {
    return rows;
  }

  const direction = activeSort.order === 'desc' ? -1 : 1;

  return rows.sort((left, right) => {
    const primaryCompare = compareInventoryRows(left, right, activeSort.key);
    if (primaryCompare !== 0) return primaryCompare * direction;

    const descriptionCompare = left.description.localeCompare(right.description, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
    if (descriptionCompare !== 0) return descriptionCompare;

    return left.reference.localeCompare(right.reference, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
});

const totalResults = computed(() => {
  if (sourceFilter.value === 'parts') return partStore.listTotal;
  if (sourceFilter.value === 'tools') return toolStore.total;
  return partStore.listTotal + toolStore.total;
});

const hasMoreResults = computed(() => {
  if (sourceFilter.value === 'parts') return partStore.listHasMore;
  if (sourceFilter.value === 'tools') return toolStore.hasMore;
  return partStore.listHasMore || toolStore.hasMore;
});

const isLoadingResults = computed(() => {
  if (sourceFilter.value === 'parts') return partStore.listLoading;
  if (sourceFilter.value === 'tools') return toolStore.loading;
  return partStore.listLoading || toolStore.loading;
});

const isLoadingMoreResults = computed(() => {
  if (sourceFilter.value === 'parts') return partStore.listLoadingMore;
  if (sourceFilter.value === 'tools') return toolStore.loadingMore;
  return partStore.listLoadingMore || toolStore.loadingMore;
});

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    void fetchPositions();
    void fetchInventory(false);
  },
  { immediate: true },
);

watch(location, (value, oldValue) => {
  if (value === oldValue) return;
  if (value === (normalizeQueryValue(route.query.loc) ?? '')) return;
  position.value = '';
  updateQueryString();
});

watch(sourceFilter, (value, oldValue) => {
  if (value === oldValue) return;
  if (
    value === ((normalizeQueryValue(route.query.source) as InventorySourceFilter | null) ?? 'all')
  )
    return;

  if (location.value && !locations.value.includes(location.value)) {
    location.value = '';
    position.value = '';
  }

  const source = value === 'parts' ? 'part' : 'tool';
  if (
    position.value &&
    value !== 'all' &&
    !rawPositionOptions.value.some(
      (option) => option.value === position.value && option.sources.includes(source),
    )
  ) {
    position.value = '';
  }

  updateQueryString();
});

watch(position, (value, oldValue) => {
  if (value === oldValue) return;
  if (value === (normalizeQueryValue(route.query.pos) ?? '')) return;
  updateQueryString();
});

watch(itemsPerPage, (value, oldValue) => {
  if (value === oldValue) return;
  window.localStorage.setItem('ipp', String(value));
  void fetchInventory(false);
});

watch(
  () => inventoryRows.value.length,
  async () => {
    await tableRef.value?.refreshLayout();
  },
);

watch([location, sourceFilter], async () => {
  await nextTick();
  await tableRef.value?.refreshLayout();
});

function getStoredItemsPerPage() {
  const stored = Number(window.localStorage.getItem('ipp'));
  return Number.isFinite(stored) && stored > 0 ? stored : 10;
}

function updateSortBy(value: Array<{ key: string; order: 'asc' | 'desc' }>) {
  sortBy.value = value.length ? value : [{ key: 'description', order: 'asc' }];
  updateQueryString();
}

function compareInventoryRows(left: InventoryRow, right: InventoryRow, key: string) {
  if (key === 'entityType') {
    return left.entityType.localeCompare(right.entityType);
  }

  if (key === 'stock') {
    return left.stock - right.stock;
  }

  const leftValue = getSortableRowValue(left, key);
  const rightValue = getSortableRowValue(right, key);

  return leftValue.localeCompare(rightValue, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function getSortableRowValue(row: InventoryRow, key: string) {
  if (key === 'reference') return row.reference || '';
  if (key === 'description') return row.description || '';
  if (key === 'location') return row.location || '';
  if (key === 'position') return row.position || '';
  return String(row[key as keyof InventoryRow] ?? '');
}

async function fetchToolLocations() {
  const { data } = await api.get<string[]>('/tools/locations');
  return data;
}

async function fetchPartLocations() {
  const { data } = await api.get<string[]>('/parts/locations');
  return data;
}

async function fetchLocations() {
  const [nextToolLocations, nextPartLocations] = await Promise.all([
    fetchToolLocations(),
    fetchPartLocations(),
  ]);
  toolLocations.value = mergeUniqueStrings(nextToolLocations);
  partLocations.value = mergeUniqueStrings(nextPartLocations);
}

async function fetchPositions() {
  if (!location.value) {
    rawPositionOptions.value = [];
    return;
  }

  const [toolPositions, partPositions] = await Promise.all([
    api.get<string[]>('/tools/positions', {
      params: { location: location.value },
    }),
    api.get<string[]>('/parts/positions', {
      params: { location: location.value },
    }),
  ]);

  rawPositionOptions.value = mergePositionOptions(toolPositions.data, partPositions.data);
}

function mergeUniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function mergePositionOptions(toolPositions: string[], partPositions: string[]): PositionOption[] {
  const optionMap = new Map<string, Set<InventoryEntityType>>();

  for (const toolPosition of toolPositions) {
    if (!toolPosition) continue;
    const sources = optionMap.get(toolPosition) ?? new Set<InventoryEntityType>();
    sources.add('tool');
    optionMap.set(toolPosition, sources);
  }

  for (const partPosition of partPositions) {
    if (!partPosition) continue;
    const sources = optionMap.get(partPosition) ?? new Set<InventoryEntityType>();
    sources.add('part');
    optionMap.set(partPosition, sources);
  }

  return [...optionMap.entries()]
    .map(([value, sources]) => ({
      value,
      sources: [...sources].sort(),
    }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function getPositionOption(item: unknown): PositionOption {
  const candidate =
    typeof item === 'object' && item !== null && 'raw' in item
      ? (item as { raw?: PositionOption }).raw
      : (item as PositionOption | undefined);

  if (candidate?.value && Array.isArray(candidate.sources)) {
    return candidate;
  }

  return {
    value: '',
    sources: [],
  };
}

function getPositionLabel(item: unknown) {
  const option = getPositionOption(item);
  if (!option.value) return '';
  if (option.sources.length === 2) return `${option.value} (Part, Tool)`;
  return `${option.value} (${option.sources[0] === 'part' ? 'Part' : 'Tool'})`;
}

function updateQueryString() {
  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !QUERY_KEYS.includes(key as never)),
  );

  const activeSort = sortBy.value[0];

  router.replace({
    query: {
      ...baseQuery,
      ...(sourceFilter.value !== 'all' ? { source: sourceFilter.value } : {}),
      ...(location.value ? { loc: location.value } : {}),
      ...(position.value ? { pos: position.value } : {}),
      ...(activeSort?.key ? { sort: activeSort.key, order: activeSort.order } : {}),
    },
  });
}

function applyRouteFilters() {
  const routeSource = normalizeQueryValue(route.query.source);
  sourceFilter.value = routeSource === 'parts' || routeSource === 'tools' ? routeSource : 'all';
  location.value = normalizeQueryValue(route.query.loc) ?? '';
  position.value = normalizeQueryValue(route.query.pos) ?? '';
  const routeSort = normalizeQueryValue(route.query.sort) ?? 'description';
  const routeOrder = normalizeQueryValue(route.query.order) === 'desc' ? 'desc' : 'asc';
  sortBy.value = [{ key: routeSort, order: routeOrder }];
}

async function fetchInventory(append: boolean) {
  if (!location.value) {
    toolStore.reset();
    partStore.resetList();
    return;
  }

  const activeSort = sortBy.value[0] ?? { key: 'description', order: 'asc' as const };
  const toolQuery: ToolListFilters = {
    location: location.value,
    position: position.value || undefined,
    limit: itemsPerPage.value,
    sort: getToolSortKey(activeSort.key),
    order: activeSort.order,
  };

  const partQuery: PartListFilters = {
    location: location.value,
    position: position.value || undefined,
    limit: itemsPerPage.value,
    sort: getPartSortKey(activeSort.key),
    order: activeSort.order,
  };

  if (sourceFilter.value === 'tools') {
    partStore.resetList();
    await toolStore.fetch(toolQuery, append);
    return;
  }

  if (sourceFilter.value === 'parts') {
    toolStore.reset();
    await partStore.fetchList(partQuery, append);
    return;
  }

  if (append) {
    return;
  }

  await Promise.all([fetchAllMatchingTools(toolQuery), fetchAllMatchingParts(partQuery)]);
}

async function fetchAllMatchingTools(query: ToolListFilters) {
  await toolStore.fetch({ ...query, limit: 100 }, false);

  while (toolStore.hasMore) {
    await toolStore.fetchNextPage();
  }
}

async function fetchAllMatchingParts(query: PartListFilters) {
  await partStore.fetchList({ ...query, limit: 100 }, false);

  while (partStore.listHasMore) {
    await partStore.fetchNextListPage();
  }
}

function getToolSortKey(key: string): ToolListFilters['sort'] {
  if (key === 'reference') return 'item';
  if (key === 'description') return 'description';
  if (key === 'location') return 'location';
  if (key === 'position') return 'position';
  if (key === 'stock') return 'stock';
  return 'description';
}

function getPartSortKey(key: string): PartListFilters['sort'] {
  if (key === 'reference') return 'part';
  if (key === 'description') return 'description';
  if (key === 'location') return 'location';
  if (key === 'position') return 'position';
  if (key === 'stock') return 'stock';
  return 'description';
}

const headers: readonly { [key: string]: unknown }[] = [
  {
    title: '',
    key: 'entityType',
    width: 56,
    sortable: false,
  },
  {
    key: 'img',
    width: 96,
    sortable: false,
  },
  {
    title: 'Item / Part',
    key: 'reference',
  },
  {
    title: 'Description',
    key: 'description',
  },
  {
    title: 'Location',
    key: 'location',
  },
  {
    title: 'Position',
    key: 'position',
  },
  {
    title: 'Stock',
    key: 'stock',
    align: 'center',
  },
];

function openInventoryRow(event: unknown, { item }: { item: InventoryRow }) {
  router.push({
    name: item.entityType === 'part' ? 'viewPart' : 'viewTool',
    params: { id: item._id },
  });
}
</script>

<style scoped>
.infinite-scroll-view-card {
  height: calc(100dvh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.infinite-scroll-view-card__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.v-card-text.tool-table-card-text {
  display: flex;
  flex: 1;
  min-height: 0;
  padding-bottom: 0;
  margin-bottom: 0;
  overflow: hidden;
}

.locations-card {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.locations-filters {
  flex: 0 0 auto;
}

.locations-table {
  flex: 1;
  min-height: 0;
}

.location-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.position-source-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 40px;
}

.position-selection {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entity-type-cell {
  display: flex;
  justify-content: center;
}

.tool-img {
  max-height: 50px;
}

.tool-img-fallback {
  width: 100px;
  min-height: 38px;
  margin: 2px auto;
  padding: 4px 6px;
  font-size: 10px;
  border-radius: 4px;
}

.tool-img--empty {
  width: 48px;
}
</style>
