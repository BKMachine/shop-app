<template>
  <v-row>
    <v-col cols="12">
      <v-card>
        <v-card-title class="header my-4 d-flex">
          Stock by Location
          <div v-if="toolStore.total && location">
            &nbsp;- {{ toolStore.total }} result{{ toolStore.total === 1 ? '' : 's' }}
          </div>
          <v-spacer />
        </v-card-title>
        <v-card-text>
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
          <v-data-table
            v-if="location"
            v-model:items-per-page="itemsPerPage"
            v-model:page="page"
            :headers="headers"
            :items="toolStore.tools"
            :items-length="toolStore.total"
            :loading="toolStore.loading"
            @click:row="openTool"
          >
            <template #['item.img']="{ item }">
              <v-img class="tool-img" :src="item.img" />
            </template>

            <template #['item.stock']="{ item }">
              <span class="stock">{{ item.stock }}</span>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/plugins/axios';
import { normalizeQueryValue } from '@/plugins/utils';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const route = useRoute();
const toolStore = useToolStore();

const location = ref('');
const position = ref('');
const page = ref(1);
const itemsPerPage = ref(getStoredItemsPerPage());
const locations = ref<string[]>([]);
const positions = ref<string[]>([]);
const QUERY_KEYS = ['loc', 'pos', 'page'] as const;

onMounted(() => {
  void fetchToolLocations();
});

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    void fetchToolPositions();
    void fetchTools();
  },
  { immediate: true },
);

watch(location, (value, oldValue) => {
  if (value === oldValue) return;
  if (value === (normalizeQueryValue(route.query.loc) ?? '')) return;
  position.value = '';
  updateQueryString(true);
});

watch(position, (value, oldValue) => {
  if (value === oldValue) return;
  if (value === (normalizeQueryValue(route.query.pos) ?? '')) return;
  updateQueryString(true);
});

watch(page, (value) => {
  const routePage = Number(normalizeQueryValue(route.query.page));
  const normalizedRoutePage = Number.isFinite(routePage) && routePage > 0 ? routePage : 1;
  if (value !== normalizedRoutePage) updateQueryString();
});

watch(itemsPerPage, (value, oldValue) => {
  if (value === oldValue) return;
  window.localStorage.setItem('ipp', String(value));
  page.value = 1;
  void fetchTools();
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

function updateQueryString(resetPage: boolean = false) {
  if (resetPage) {
    page.value = 1;
  }

  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !QUERY_KEYS.includes(key as never)),
  );

  router.replace({
    query: {
      ...baseQuery,
      ...(location.value ? { loc: location.value } : {}),
      ...(position.value ? { pos: position.value } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    },
  });
}

function applyRouteFilters() {
  location.value = normalizeQueryValue(route.query.loc) ?? '';
  position.value = normalizeQueryValue(route.query.pos) ?? '';

  const nextPage = Number(normalizeQueryValue(route.query.page));
  page.value = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1;
}

async function fetchTools() {
  if (!location.value) return;

  await toolStore.fetch({
    location: location.value,
    position: position.value || undefined,
    limit: itemsPerPage.value,
    offset: (page.value - 1) * itemsPerPage.value,
    sort: 'description',
    order: 'asc',
  });
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
.tool-img {
  max-height: 50px;
}
</style>
