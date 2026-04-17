<template>
  <v-card>
    <v-card-title class="header my-4">
      <div>Parts - {{ partStore.total }}</div>
      <div class="header-actions">
        <v-checkbox
          v-model="showSubComponents"
          class="parts-sub-toggle"
          color="primary"
          density="compact"
          hide-details
          label="Show Subcomponents"
          @update:model-value="syncFiltersToQuery"
        />
        <v-btn color="secondary" link prepend-icon="mdi-plus" :to="{ name: 'createPart' }">
          Create New Part
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-row no-gutters>
        <v-col cols="8">
          <v-text-field
            v-model="search"
            class="my-2 mr-2"
            clearable
            label="Search"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
            @update:model-value="syncFiltersToQuery"
          >
            <template #details>
              <div class="search-details">
                <button class="clear-filters-hint" type="button" @click="clearAllFilters">
                  Clear all filters
                </button>
              </div>
            </template>
          </v-text-field>
        </v-col>
        <v-col cols="4">
          <CustomerSelect
            v-model="selectedCustomerId"
            class="my-2 ml-2"
            clearable
            hide-details
            label="Customer"
            variant="outlined"
            @update:model-value="syncFiltersToQuery"
          />
        </v-col>
      </v-row>
      <InfiniteScrollDataTable
        ref="tableRef"
        :custom-key-sort="customKeySort"
        :has-more="partStore.listHasMore"
        :headers="headers"
        :items="partStore.listParts"
        :loading="partStore.listLoading"
        :loading-more="partStore.listLoadingMore"
        :sort-by="sortBy"
        @click:row="openPart"
        @load-more="loadMore"
        @update:sort-by="updateSortBy"
      >
        <template #['item.shopRate']="{ item }">
          <div class="rate-swatch-cell">
            <span
              :class="[
                'rate-swatch',
                item.isSubComponent ? 'rate-swatch--subcomponent' : '',
                item.hasSubComponents ? 'rate-swatch--assembly' : '',
                `rate-swatch--${getTone(item)}`,
              ]"
              :title="item.derived?.shopRate
                ? `$${item.derived.shopRate.toFixed(2)}`
                : 'No rate'"
              @click.stop="openPartCost(item)"
            />
          </div>
        </template>
        <template #['item.img']="{ item }">
          <v-hover>
            <template #default="{ isHovering, props }">
              <v-img
                v-if="hasPartImage(item)"
                v-bind="props"
                :id="item._id"
                class="part-img"
                :src="item.img"
                @error="markImageMissing(item._id)"
                @mouseenter="showExpandedImage(item, $event)"
                @mouseleave="hideExpandedImage"
              > </v-img>
              <MissingImage v-else class="part-img part-img-fallback" />
            </template>
          </v-hover>
        </template>
        <template #['item.location']="{ item }"> {{ location(item) }} </template>
        <template #['item.stock']="{ item }">
          <div class="d-flex align-center">
            <v-dialog max-width="500">
              <template #activator="{ props: activatorProps }">
                <v-btn v-bind="activatorProps">
                  <span class="stock mr-2"> {{ item.stock }} </span>
                  <v-icon color="secondary" icon="mdi-contrast" size="large" />
                </v-btn>
              </template>

              <template #default="{ isActive }">
                <v-card>
                  <PartsAdjustStockDialog :part="item" @close-dialog="isActive.value = false" />
                </v-card>
              </template>
            </v-dialog>
          </div>
        </template>
      </InfiniteScrollDataTable>
    </v-card-text>
  </v-card>

  <teleport to="body">
    <div
      v-if="expandedImage.visible"
      class="expanded-img-container"
      :style="{ top: expandedImage.top + 'px', left: expandedImage.left + 'px' }"
    >
      <v-img class="expanded-img" :src="expandedImage.src" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { type LocationQueryValue, type LocationQueryValueRaw, useRoute } from 'vue-router';
import CustomerSelect from '@/components/CustomerSelect.vue';
import InfiniteScrollDataTable from '@/components/InfiniteScrollDataTable.vue';
import MissingImage from '@/components/MissingImage.vue';
import PartsAdjustStockDialog from '@/components/parts/PartsAdjustStockDialog.vue';
import { getToneForRate } from '@/plugins/rates_theme';
import router from '@/router';
import { usePartStore } from '@/stores/parts_store';

type PartsListRow = Part & {
  shopRate: number;
  hasSubComponents: boolean;
  isSubComponent: boolean;
  hasNoProductPrice: boolean;
};

const partStore = usePartStore();
const route = useRoute();

const listPageSize = 30;
const sortBy = ref<Array<{ key: string; order: 'asc' | 'desc' }>>([{ key: 'part', order: 'asc' }]);
const search = ref('');
const selectedCustomerId = ref<string | null>(null);
const showSubComponents = ref(false);
const missingImageIds = ref<Record<string, boolean>>({});
const tableRef = ref<InstanceType<typeof InfiniteScrollDataTable> | null>(null);
const FILTER_QUERY_KEYS = ['search', 'customer', 'subcomponents', 'sort', 'order'] as const;
const isFilterQueryKey = (key: string): key is (typeof FILTER_QUERY_KEYS)[number] =>
  FILTER_QUERY_KEYS.includes(key as (typeof FILTER_QUERY_KEYS)[number]);

const headers = [
  {
    key: 'img',
    width: 150,
    sortable: false,
  },
  {
    title: 'Part #',
    key: 'part',
  },
  {
    title: 'Description',
    key: 'description',
  },

  {
    key: 'customer.name',
    title: 'Customer',
  },
  {
    title: '$/hr',
    key: 'shopRate',
    width: 80,
  },
  {
    title: 'Location',
    key: 'location',
  },
  {
    title: 'Stock',
    key: 'stock',
  },
];

const customKeySort = computed(() => {
  return Object.fromEntries(headers.map(({ key }) => [key, () => 0]));
});

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    void fetchParts();
  },
  { immediate: true },
);

watch(
  () => partStore.listParts,
  async () => {
    await tableRef.value?.refreshLayout();
    if (!partStore.lastId) return;
    await nextTick();
    const el = document.getElementById(partStore.lastId);
    if (el) {
      const parent = el.parentElement?.parentElement;
      if (parent) {
        parent.classList.add('highlighted');
      }
      partStore.setLastId(null);
    }
  },
  { immediate: true },
);

watch(
  () => partStore.listParts.length,
  async () => {
    await tableRef.value?.refreshLayout();
  },
);

async function fetchParts() {
  partStore.resetList();
  await partStore.fetchList({
    search: search.value || undefined,
    customer: selectedCustomerId.value || undefined,
    includeSubcomponents: showSubComponents.value || undefined,
    sort: sortBy.value[0]?.key || undefined,
    order: sortBy.value[0]?.order || undefined,
    limit: listPageSize,
    offset: 0,
  });
}

function updateSortBy(value: Array<{ key: string; order: 'asc' | 'desc' }>) {
  if (partStore.listLoading || partStore.listLoadingMore) return;
  sortBy.value = value.length ? value : [{ key: 'part', order: 'asc' }];
  syncFiltersToQuery();
}

function loadMore() {
  void partStore.fetchNextListPage();
}

function getTone(item: PartsListRow) {
  if (!item.price) return 'empty';
  return getToneForRate(item.derived?.shopRate || 0);
}

function openPart(event: unknown, { item }: { item: PartsListRow }) {
  router.push({ name: 'viewPart', params: { id: item._id } });
}

function openPartCost(item: PartsListRow) {
  router.push({ name: 'viewPart', params: { id: item._id }, query: { tab: 'cost' } });
}

function location(part: PartsListRow) {
  let text = part.location || '';
  if (part.position) text += ' - ' + part.position;
  return text;
}

function hasPartImage(part: PartsListRow) {
  return Boolean(part.img?.trim()) && !missingImageIds.value[part._id];
}

function markImageMissing(partId: string) {
  missingImageIds.value = {
    ...missingImageIds.value,
    [partId]: true,
  };
  if (expandedImage.value.visible && expandedImage.value.partId === partId) {
    hideExpandedImage();
  }
}

const expandedImage = ref({
  visible: false,
  partId: '',
  src: '',
  top: 0,
  left: 0,
});

function showExpandedImage(part: PartsListRow, event: MouseEvent) {
  if (!hasPartImage(part) || !part.img) return;
  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  expandedImage.value = {
    visible: true,
    partId: part._id,
    src: part.img,
    top: rect.top,
    left: rect.right,
  };
}

function hideExpandedImage() {
  expandedImage.value = {
    visible: false,
    partId: '',
    src: '',
    top: 0,
    left: 0,
  };
}

function applyRouteFilters() {
  search.value = firstQueryValue(route.query.search) ?? '';
  selectedCustomerId.value = firstQueryValue(route.query.customer) ?? null;
  showSubComponents.value = firstQueryValue(route.query.subcomponents) === 'true';
  const sortKey = firstQueryValue(route.query.sort) ?? 'part';
  const sortOrder = firstQueryValue(route.query.order) === 'desc' ? 'desc' : 'asc';
  sortBy.value = [{ key: sortKey, order: sortOrder }];
}

function syncFiltersToQuery() {
  const nextQuery = buildFilterQuery();

  if (areFilterQueriesEqual(route.query, nextQuery)) {
    return;
  }

  router.replace({
    query: nextQuery,
  });
}

function clearAllFilters() {
  search.value = '';
  selectedCustomerId.value = null;
  showSubComponents.value = false;
  sortBy.value = [{ key: 'part', order: 'asc' }];
  syncFiltersToQuery();
}

function buildFilterQuery() {
  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !isFilterQueryKey(key)),
  );

  return {
    ...baseQuery,
    ...(search.value ? { search: search.value } : {}),
    ...(selectedCustomerId.value ? { customer: selectedCustomerId.value } : {}),
    ...(showSubComponents.value ? { subcomponents: 'true' } : {}),
    ...(sortBy.value[0]?.key ? { sort: sortBy.value[0].key, order: sortBy.value[0].order } : {}),
  };
}

function firstQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue ?? undefined;
}

function areFilterQueriesEqual(
  currentQuery: Record<string, LocationQueryValue | LocationQueryValue[] | undefined>,
  nextQuery: Record<string, LocationQueryValueRaw | LocationQueryValueRaw[] | undefined>,
) {
  const currentEntries = Object.entries(currentQuery)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]);
  const nextEntries = Object.entries(nextQuery)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]);

  if (currentEntries.length !== nextEntries.length) return false;

  return currentEntries.every(([key, value]) => {
    return nextEntries.some(([nextKey, nextValue]) => nextKey === key && nextValue === value);
  });
}
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-details {
  min-height: 18px;
  padding-top: 2px;
}

.clear-filters-hint {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 300;
  color: #1e88e5;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}

.stock {
  font-weight: bolder;
  font-size: 1.1em;
  min-width: 4ch; /* reserve space for 4 digits */
  text-align: center;
  display: inline-block;
}

.part-img {
  max-height: 50px;
}

.expanded-img-container {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.expanded-img {
  width: 360px;
  max-height: 360px;
  border: 1px solid #ccc;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.rate-swatch-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.highlighted {
  background: #efefef;
}

.rate-swatch {
  width: 30px;
  height: 18px;
  border-radius: 6px;
  display: inline-block;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: currentColor;
  box-shadow: inset 0 0 0 1px rgba(107, 114, 128, 0.6);
}

.rate-swatch--empty {
  background: white;
}

.rate-swatch--subcomponent {
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.92) 0%,
    rgba(148, 163, 184, 0.92) 46%,
    rgba(255, 255, 255, 0.98) 46%,
    rgba(255, 255, 255, 0.98) 54%,
    currentColor 54%,
    currentColor 100%
  );
}

.rate-swatch--empty.rate-swatch--subcomponent {
  color: white;
}

.rate-swatch--assembly::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(0, 0, 0, 0.18) 0px,
      rgba(0, 0, 0, 0.18) 3px,
      rgba(255, 255, 255, 0.06) 3px,
      rgba(255, 255, 255, 0.06) 6px
    ),
    linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.12));
  pointer-events: none;
}

.parts-sub-toggle {
  margin-top: 0;
}

.part-img-fallback {
  width: 38px;
  min-height: 38px;
  margin: 2px auto;
  padding: 4px 6px;
  font-size: 10px;
  border-radius: 4px;
}
</style>
