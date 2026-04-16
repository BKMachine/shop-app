<template>
  <v-card>
    <v-card-title class="header">
      <div>{{ resultsTitle }}</div>
      <div v-if="category !== 'all'">
        <v-btn color="primary" link prepend-icon="mdi-plus" :to="{ name: 'createTool' }">
          Create New Tool
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text class="tool-table-card-text">
      <v-card flat>
        <template #text>
          <div v-if="category === 'milling'">
            <v-row>
              <v-col cols="6">
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
              <v-col cols="6">
                <v-row>
                  <v-col cols="4">
                    <v-select
                      v-model="selectedToolType"
                      clearable
                      :items="types"
                      label="Tool Type"
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      v-model="cuttingDiaFilter"
                      clearable
                      label="Cutting Dia"
                      @keydown="isNumber($event)"
                    />
                  </v-col>
                  <v-col cols="4">
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
            <v-row />
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
                <v-select v-model="selectedToolType" clearable :items="types" label="Tool Type" />
              </v-col>
            </v-row>
          </div>
          <div v-else>
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
          </div>
        </template>

        <InfiniteScrollDataTable
          ref="tableRef"
          :custom-key-sort="customKeySort"
          :has-more="hasMore"
          :headers="headers"
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
import { isNumber } from '@/plugins/utils';
import router from '@/router';
import { useToolCategoryStore } from '@/stores/tool_category_store';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  title: string;
  headers: { key: string; title?: string }[];
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
const tableSortBy = computed(() => {
  return props.sortBy ? [{ key: props.sortBy, order: props.order }] : [];
});

const customKeySort = computed(() => {
  return Object.fromEntries(
    props.headers
      .map(({ key }) => key)
      .filter((key): key is string => Boolean(key))
      .map((key) => [key, () => 0]),
  );
});

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
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.search-details {
  min-height: 18px;
  padding-top: 2px;
}

.v-card-text.tool-table-card-text {
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
