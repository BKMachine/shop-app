<template>
  <v-card class="tools-table-card">
    <v-card-title class="header">
      <div>{{ resultsTitle }}</div>
      <div class="tools-table-card__actions mb-4">
        <v-menu v-if="category !== 'all'" :close-on-content-click="false" location="bottom end">
          <template #activator="{ props: activatorProps }">
            <v-badge
              class="mr-2"
              color="primary"
              dot
              location="top end"
              :model-value="hiddenToolTypeKeys.length > 0"
              offset-x="-3"
              offset-y="1"
              size="xs-small"
            >
              <v-icon
                v-bind="activatorProps"
                aria-label="Hidden Tool Types"
                color="grey-darken-2"
                icon="mdi-filter-cog-outline"
                size="24"
              />
            </v-badge>
          </template>

          <v-list density="compact">
            <v-list-subheader>Hidden By Default</v-list-subheader>
            <v-list-item v-for="toolTypeOption in types" :key="toolTypeOption" density="compact">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="hiddenToolTypeKeys.includes(toolTypeOption)"
                  @update:model-value="toggleHiddenToolType(toolTypeOption, $event)"
                />
              </template>
              <v-list-item-title>{{ toolTypeOption }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-menu :close-on-content-click="false" location="bottom end">
          <template #activator="{ props: activatorProps }">
            <v-icon
              v-bind="activatorProps"
              aria-label="Show Columns"
              class="mr-2"
              color="grey-darken-2"
              icon="mdi-view-column-outline"
              size="24"
            />
          </template>

          <v-list density="compact">
            <v-list-subheader>Visible Columns</v-list-subheader>
            <v-list-item v-for="column in toggleableHeaders" :key="column.key" density="compact">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="visibleHeaderKeys.includes(column.key)"
                  @update:model-value="toggleHeader(column.key, $event)"
                />
              </template>
              <v-list-item-title>{{ column.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-btn
          v-if="category !== 'all'"
          color="primary"
          link
          prepend-icon="mdi-plus"
          :to="{ name: 'createTool' }"
        >
          Create New Tool
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text class="tool-table-card-text">
      <v-card class="tools-table-card__inner" flat>
        <div class="tools-table-card__filters">
          <div v-if="category === 'milling'">
            <v-row>
              <v-col cols="5">
                <v-text-field
                  v-model="searchText"
                  class="milling-search"
                  clearable
                  label="Search"
                  prepend-inner-icon="mdi-magnify"
                  single-line
                  variant="outlined"
                >
                  <template #details>
                    <div class="search-details">
                      <button
                        class="clear-filters-hint"
                        type="button"
                        @click="emits('clearAllFilters')"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="7">
                <v-row>
                  <v-col cols="6">
                    <v-autocomplete
                      v-model="selectedToolType"
                      clearable
                      :items="types"
                      label="Tool Type"
                    />
                  </v-col>
                  <v-col cols="3">
                    <v-text-field
                      v-model="cuttingDiaFilter"
                      clearable
                      label="Cutting Dia"
                      @keydown="isNumber($event)"
                    />
                  </v-col>
                  <v-col cols="3">
                    <v-text-field
                      v-model="minFluteLengthFilter"
                      clearable
                      label="Min Flute Length"
                      @keydown="isNumber($event)"
                    />
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </div>
          <div v-else-if="category !== 'all'">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="searchText"
                  clearable
                  label="Search"
                  prepend-inner-icon="mdi-magnify"
                  single-line
                  variant="outlined"
                >
                  <template #details>
                    <div class="search-details">
                      <button
                        class="clear-filters-hint"
                        type="button"
                        @click="emits('clearAllFilters')"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="6">
                <v-autocomplete
                  v-model="selectedToolType"
                  clearable
                  :items="types"
                  label="Tool Type"
                />
              </v-col>
            </v-row>
          </div>
          <div v-else>
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="searchText"
                  clearable
                  label="Search"
                  prepend-inner-icon="mdi-magnify"
                  single-line
                  variant="outlined"
                >
                  <template #details>
                    <div class="search-details">
                      <button
                        class="clear-filters-hint"
                        type="button"
                        @click="emits('clearAllFilters')"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="6">
                <v-autocomplete
                  v-model="selectedToolType"
                  clearable
                  :items="types"
                  label="Tool Type"
                />
              </v-col>
            </v-row>
          </div>
        </div>

        <InfiniteScrollDataTable
          ref="tableRef"
          :custom-key-sort="customKeySort"
          :has-more="hasMore"
          :headers="visibleHeaders"
          :items="items"
          :loading="toolStore.loading"
          :loading-more="loadingMore"
          :sort-by="tableSortBy"
          @click:row="openTool"
          @load-more="emits('loadMore')"
          @update:sort-by="updateSearchBy"
        >
          <template #['item.img']="{ item }">
            <v-img v-if="item.img" :id="item._id" class="tool-img" :src="item.img" />
            <MissingImage v-else :id="item._id" class="tool-img tool-img-fallback" />
          </template>
          <template #['item.cost']="{ item }">
            <span class="stock">${{ formatCost(item.cost) }}</span>
          </template>
          <template #['item.location']="{ item }"> {{ location(item) }} </template>
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
import InfiniteScrollDataTable from '@/components/InfiniteScrollDataTable.vue';
import MissingImage from '@/components/MissingImage.vue';
import { formatCost, isNumber } from '@/plugins/utils';
import router from '@/router';
import { useToolCategoryStore } from '@/stores/tool_category_store';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  title: string;
  headers: { key: string; title?: string; defaultVisible?: boolean }[];
  items: Tool[];
  totalItems: number;
  hasMore: boolean;
  loadingMore: boolean;
  category: ToolFilterCategory;
  search: string;
  toolType: string | null;
  cuttingDia: string;
  minFluteLength: string;
  sortBy: string;
  order: 'asc' | 'desc';
}>();

const emits = defineEmits([
  'updateSearch',
  'updateToolType',
  'updateHiddenToolTypes',
  'updateCuttingDia',
  'updateMinFluteLength',
  'updateSearchBy',
  'loadMore',
  'clearAllFilters',
]);

const toolStore = useToolStore();
const toolCategoryStore = useToolCategoryStore();
const searchText = ref<string>(props.search);
const cuttingDiaFilter = ref<string>(props.cuttingDia);
const minFluteLengthFilter = ref<string>(props.minFluteLength);
const selectedToolType = ref<string | null>(props.toolType);
const tableRef = ref<InstanceType<typeof InfiniteScrollDataTable> | null>(null);
const visibleHeaderKeys = ref<string[]>([]);
const hiddenToolTypeKeys = ref<string[]>([]);
const visibleColumnsStorageKey = computed(() => `tools-table-visible-columns:${props.category}`);
const hiddenToolTypesStorageKey = computed(() => `tools-table-hidden-tool-types:${props.category}`);
const tableSortBy = computed(() => {
  return props.sortBy ? [{ key: props.sortBy, order: props.order }] : [];
});

const toggleableHeaders = computed(() => {
  return props.headers.filter((header) => header.title && header.key !== 'img');
});

const visibleHeaders = computed(() => {
  return props.headers.filter((header) => {
    if (header.key === 'img') return true;
    return visibleHeaderKeys.value.includes(header.key);
  });
});

const customKeySort = computed(() => {
  return Object.fromEntries(
    visibleHeaders.value
      .map(({ key }) => key)
      .filter((key): key is string => Boolean(key))
      .map((key) => [key, () => 0]),
  );
});

function syncVisibleHeaders() {
  const availableHeaders = props.headers.filter((header) => header.key !== 'img');
  const candidateKeys = visibleHeaderKeys.value.length
    ? visibleHeaderKeys.value
    : getStoredVisibleHeaderKeys();

  visibleHeaderKeys.value = candidateKeys.length
    ? availableHeaders
        .filter((header) => candidateKeys.includes(header.key))
        .map((header) => header.key)
    : availableHeaders
        .filter((header) => header.defaultVisible !== false)
        .map((header) => header.key);
}

function getStoredVisibleHeaderKeys() {
  if (typeof window === 'undefined') return [];

  const storedValue = window.localStorage.getItem(visibleColumnsStorageKey.value);
  if (!storedValue) return [];

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistVisibleHeaderKeys() {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    visibleColumnsStorageKey.value,
    JSON.stringify(visibleHeaderKeys.value),
  );
}

function syncHiddenToolTypes() {
  if (props.category === 'all') {
    hiddenToolTypeKeys.value = [];
    return;
  }

  const availableTypes = new Set(types.value);
  const candidateKeys = hiddenToolTypeKeys.value.length
    ? hiddenToolTypeKeys.value
    : getStoredHiddenToolTypes();

  if (candidateKeys.length) {
    hiddenToolTypeKeys.value = candidateKeys.filter((toolTypeOption) =>
      availableTypes.has(toolTypeOption),
    );
    return;
  }

  hiddenToolTypeKeys.value =
    props.category === 'turning' && availableTypes.has('Hardware Tool Category')
      ? ['Hardware Tool Category']
      : [];
}

function getStoredHiddenToolTypes() {
  if (typeof window === 'undefined') return [];

  const storedValue = window.localStorage.getItem(hiddenToolTypesStorageKey.value);
  if (!storedValue) return [];

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistHiddenToolTypes() {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    hiddenToolTypesStorageKey.value,
    JSON.stringify(hiddenToolTypeKeys.value),
  );
}

const resultsTitle = computed(() => {
  let title = props.title;
  if (props.totalItems > 0) {
    title += ` - ${props.totalItems} result${props.totalItems === 1 ? '' : 's'}`;
  }
  return `${title}`;
});

const types = computed<readonly string[]>(() => {
  return toolCategoryStore.getTypes(props.category);
});

watch(searchText, () => {
  emits('updateSearch', searchText.value);
});

watch(selectedToolType, () => {
  emits('updateToolType', selectedToolType.value);
});

watch(hiddenToolTypeKeys, () => {
  emits('updateHiddenToolTypes', props.category === 'all' ? [] : [...hiddenToolTypeKeys.value]);
  persistHiddenToolTypes();
});

watch(cuttingDiaFilter, () => {
  emits('updateCuttingDia', cuttingDiaFilter.value);
});

watch(minFluteLengthFilter, () => {
  emits('updateMinFluteLength', minFluteLengthFilter.value);
});

watch(
  () => props.search,
  (value) => {
    if (searchText.value !== value) searchText.value = value;
  },
);

watch(
  [() => props.headers, visibleColumnsStorageKey],
  () => {
    visibleHeaderKeys.value = getStoredVisibleHeaderKeys();
    syncVisibleHeaders();
  },
  { immediate: true },
);

watch(visibleHeaderKeys, () => {
  persistVisibleHeaderKeys();
});

watch(
  [() => props.category, types, hiddenToolTypesStorageKey],
  () => {
    hiddenToolTypeKeys.value = getStoredHiddenToolTypes();
    syncHiddenToolTypes();
  },
  { immediate: true },
);

watch(
  () => props.toolType,
  (value) => {
    if (selectedToolType.value !== value) selectedToolType.value = value;
  },
);

watch(
  () => props.cuttingDia,
  (value) => {
    if (cuttingDiaFilter.value !== value) cuttingDiaFilter.value = value;
  },
);

watch(
  () => props.minFluteLength,
  (value) => {
    if (minFluteLengthFilter.value !== value) minFluteLengthFilter.value = value;
  },
);

function updateSearchBy(value: { key: string; order: 'asc' | 'desc' }[]) {
  if (toolStore.loading || props.loadingMore) return;
  emits('updateSearchBy', value);
}

function openTool(event: unknown, { item }: { item: Tool }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}

watch(
  () => props.items,
  async () => {
    await tableRef.value?.refreshLayout();
    if (!toolStore.lastId) return;
    await nextTick();
    const el = document.getElementById(toolStore.lastId);
    if (el) {
      const parent = el.parentElement?.parentElement;
      if (parent) {
        parent.classList.add('highlighted');
      }
      toolStore.setLastId(null);
    }
  },
  { immediate: true },
);

watch(
  () => props.category,
  async () => {
    await tableRef.value?.refreshLayout();
  },
);

watch(
  () => props.items.length,
  async () => {
    await tableRef.value?.refreshLayout();
  },
);

function location(tool: Tool): string {
  let text = tool.location || '';
  if (tool.position) text += ' - ' + tool.position;
  return text;
}

function toggleHeader(key: string, enabled: boolean) {
  if (enabled) {
    if (!visibleHeaderKeys.value.includes(key)) {
      visibleHeaderKeys.value = [...visibleHeaderKeys.value, key];
    }
    return;
  }

  visibleHeaderKeys.value = visibleHeaderKeys.value.filter((headerKey) => headerKey !== key);
}

function toggleHiddenToolType(toolTypeOption: string, enabled: boolean) {
  if (enabled) {
    if (!hiddenToolTypeKeys.value.includes(toolTypeOption)) {
      hiddenToolTypeKeys.value = [...hiddenToolTypeKeys.value, toolTypeOption];
    }
    return;
  }

  hiddenToolTypeKeys.value = hiddenToolTypeKeys.value.filter(
    (hiddenToolType) => hiddenToolType !== toolTypeOption,
  );
}
</script>

<style scoped>
.tools-table-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tools-table-card__inner {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.tools-table-card__filters {
  flex: 0 0 auto;
}

.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.tools-table-card__actions {
  display: flex;
  align-items: center;
}

.search-details {
  min-height: 18px;
  padding-top: 2px;
}

.v-card-text.tool-table-card-text {
  display: flex;
  flex: 1;
  min-height: 0;
  padding-bottom: 0;
  margin-bottom: 0;
  overflow: hidden;
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
</style>

<style scoped>
.highlighted {
  background: #efefef;
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
</style>
