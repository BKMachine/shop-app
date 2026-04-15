<template>
  <v-card>
    <v-card-title class="header my-4 d-flex">
      Stock by Location
      <div v-if="toolStore.total && location">
        &nbsp;- {{ toolStore.total }} result{{ toolStore.total === 1 ? '' : 's' }}
      </div>
      <v-spacer />
    </v-card-title>
    <v-card-text class="tool-table-card-text">
      <v-card flat>
        <template #text>
          <v-row>
            <v-col cols="6">
              <v-select v-model="location" clearable :items="locations" label="Location" />
            </v-col>
            <v-col cols="6">
              <v-select v-model="position" clearable :items="positions" label="Position">
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
        </template>

        <div v-if="location" ref="tableHost" class="tool-table-host">
          <v-data-table-virtual
            fixed-header
            :headers="headers"
            :height="tableHeight"
            :items="toolStore.tools"
            :loading="toolStore.loading"
            @click:row="openTool"
          >
            <template #['item.img']="{ item }">
              <v-img class="tool-img" :src="item.img" />
            </template>

            <template #['item.stock']="{ item }">
              <span class="stock">{{ item.stock }}</span>
            </template>

            <template #bottom>
              <div v-if="isTableScrollable" class="tool-table-status">
                <span v-if="isAtTableBottom && toolStore.loadingMore">Loading more tools...</span>
                <span v-else-if="isAtTableBottom && !toolStore.hasMore && toolStore.tools.length">
                  All tools loaded.
                </span>
              </div>
            </template>
          </v-data-table-virtual>
        </div>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useVirtualTableScroll } from '@/lib/useVirtualTableScroll';
import api from '@/plugins/axios';
import { normalizeQueryValue } from '@/plugins/utils';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const route = useRoute();
const toolStore = useToolStore();

const location = ref('');
const position = ref('');
const itemsPerPage = ref(getStoredItemsPerPage());
const locations = ref<string[]>([]);
const positions = ref<string[]>([]);
const tableHost = ref<HTMLElement | null>(null);
const { bindScrollElement, isAtTableBottom, isTableScrollable, tableHeight, updateTableHeight } =
  useVirtualTableScroll({
    tableHost,
    canLoadMore: () => !toolStore.loading && !toolStore.loadingMore && toolStore.hasMore,
    onLoadMore: () => fetchTools(true),
  });
const QUERY_KEYS = ['loc', 'pos'] as const;

void fetchToolLocations();

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    void fetchToolPositions();
    void fetchTools(false);
  },
  { immediate: true },
);

watch(location, (value, oldValue) => {
  if (value === oldValue) return;
  if (value === (normalizeQueryValue(route.query.loc) ?? '')) return;
  position.value = '';
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
  void fetchTools(false);
});

watch(
  () => toolStore.tools.length,
  async () => {
    await nextTick();
    updateTableHeight();
    await bindScrollElement();
  },
);

watch(
  () => toolStore.hasMore,
  () => {
    void bindScrollElement();
  },
);

watch(location, async () => {
  await nextTick();
  updateTableHeight();
});

function getStoredItemsPerPage() {
  const stored = Number(window.localStorage.getItem('ipp'));
  return Number.isFinite(stored) && stored > 0 ? stored : 10;
}

async function fetchToolLocations() {
  const { data } = await api.get<string[]>('/tools/locations');
  locations.value = data.sort((left, right) => left.localeCompare(right));
}

async function fetchToolPositions() {
  if (!location.value) {
    positions.value = [];
    return;
  }

  const { data } = await api.get<string[]>('/tools/positions', {
    params: { location: location.value },
  });

  positions.value = data.sort((left, right) => left.localeCompare(right));
}

function updateQueryString() {
  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !QUERY_KEYS.includes(key as never)),
  );

  router.replace({
    query: {
      ...baseQuery,
      ...(location.value ? { loc: location.value } : {}),
      ...(position.value ? { pos: position.value } : {}),
    },
  });
}

function applyRouteFilters() {
  location.value = normalizeQueryValue(route.query.loc) ?? '';
  position.value = normalizeQueryValue(route.query.pos) ?? '';
}

async function fetchTools(append: boolean) {
  if (!location.value) {
    toolStore.reset();
    return;
  }

  await toolStore.fetch(
    {
      location: location.value,
      position: position.value || undefined,
      limit: itemsPerPage.value,
      sort: 'description',
      order: 'asc',
    },
    append,
  );
}

const headers: readonly { [key: string]: unknown }[] = [
  {
    key: 'img',
    width: 150,
    sortable: false,
  },
  {
    title: 'Item',
    key: 'item',
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

function openTool(event: unknown, { item }: { item: Tool }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}
</script>

<style scoped>
.v-card-text.tool-table-card-text {
  padding-bottom: 0;
  margin-bottom: 0;
  overflow: hidden;
}

.tool-img {
  max-height: 50px;
}

.tool-table-host {
  position: relative;
  overflow: hidden;
}

.tool-table-status {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
}
</style>
