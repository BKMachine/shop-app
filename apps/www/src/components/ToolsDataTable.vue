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
    <v-card-text>
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

        <v-data-table
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :headers="headers"
          :items="filteredItems"
          :loading="toolStore.loading"
          :search="search"
          @click:row="openTool"
        >
          <template #['item.img']="{ item }">
            <v-img v-if="item.img" :id="item._id" class="tool-img" :src="item.img" />
            <MissingImage v-else :id="item._id" class="tool-img tool-img-fallback" />
          </template>
          <template #['item.location']="{ item }"> {{ location(item) }} </template>
          <template #['item.stock']="{ item }">
            <span class="stock">{{ item.stock }}</span>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import MissingImage from '@/components/MissingImage.vue';
import toolTypes from '@/plugins/toolTypes';
import { isNumber } from '@/plugins/utils';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  title: string;
  headers: { key: string; title?: string }[];
  items: Tool[];
  category: ToolCategory;
  search: string;
  toolType: string;
  cuttingDia: string;
  minFluteLength: string;
}>();

const emits = defineEmits([
  'updateSearch',
  'updateToolType',
  'updateCuttingDia',
  'updateMinFluteLength',
  'clearAllFilters',
]);

const toolStore = useToolStore();
const searchText = ref<string>(props.search);
const page = ref(1);
const itemsPerPage = ref(10);
const cuttingDiaFilter = ref<string>(props.cuttingDia);
const minFluteLengthFilter = ref<string>(props.minFluteLength);
const selectedToolType = ref<string>(props.toolType);
const resultsTitle = computed(() => {
  let title = props.title;
  if (props.items.length !== filteredItems.value.length)
    title += ` - ${filteredItems.value.length} results`;
  return `${title}`;
});

const types = computed<readonly string[]>(() => {
  return toolTypes[props.category];
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

const filteredItems = computed<Tool[]>(() => {
  if (props.category === 'milling') {
    let cuttingDiaNum: number;
    let minFluteLengthNum: number;
    try {
      if (cuttingDiaFilter.value) cuttingDiaNum = parseFloat(cuttingDiaFilter.value);
      if (minFluteLengthFilter.value) minFluteLengthNum = parseFloat(minFluteLengthFilter.value);
    } catch (e) {
      return props.items;
    }
    return [...props.items]
      .filter((x) => {
        if (selectedToolType.value) {
          if (selectedToolType.value === x.toolType) return true;
        }
        return !selectedToolType.value;
      })
      .filter((x) => {
        if (Number.isNaN(cuttingDiaNum)) return cuttingDiaFilter.value;
        if (cuttingDiaNum && x.cuttingDia) {
          if (cuttingDiaNum > 0 && x.cuttingDia.toString().startsWith(cuttingDiaNum.toString()))
            return true;
        }
        return !cuttingDiaFilter.value;
      })
      .filter((x) => {
        if (Number.isNaN(minFluteLengthNum)) return minFluteLengthFilter.value;
        if (minFluteLengthFilter.value && x.fluteLength) {
          if (minFluteLengthNum > 0 && minFluteLengthNum <= x.fluteLength) return true;
        }
        return !minFluteLengthFilter.value;
      });
  }
  return props.items;
});

function openTool(event: unknown, { item }: { item: Tool }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}

watch(page, () => {
  const query = { ...router.currentRoute.value.query };
  if (page.value === 1) delete query.page;
  else query.page = String(page.value);
  router.replace({ query });
});

watch(itemsPerPage, () => {
  localStorage.setItem('ipp', itemsPerPage.value.toString());
});

onMounted(() => {
  // Do items per page before page number
  const ipp = localStorage.getItem('ipp');
  if (ipp) {
    const ippNum = parseInt(ipp, 10);
    if (!Number.isNaN(ippNum)) itemsPerPage.value = ippNum;
  }

  const tabChanged = toolStore.tabChange;
  if (tabChanged) {
    page.value = 1;
    toolStore.setTabChange(false);
  } else {
    const query = router.currentRoute.value.query;
    if (query.page) {
      const pageNum = parseInt(query.page as string, 10);
      if (!Number.isNaN(pageNum)) page.value = pageNum;
    }
  }

  setTimeout(() => {
    if (toolStore.lastId) {
      const el = document.getElementById(toolStore.lastId);
      if (el) {
        const parent = el.parentElement?.parentElement;
        if (parent) {
          parent.classList.add('highlighted');
        }
      }
      toolStore.setLastId(null);
    }
  }, 150);
});

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
