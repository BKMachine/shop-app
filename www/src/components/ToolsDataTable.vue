<template>
  <v-card>
    <v-card-title class="header">
      <div>{{ resultsTitle }}</div>
      <div>
        <v-btn link :to="{ name: 'createTool' }" color="primary" prepend-icon="mdi-plus">
          Create New Tool
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-card flat>
        <template v-slot:text>
          <div v-if="category === 'milling'">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="search"
                  class="milling-search"
                  label="Search"
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  single-line
                  hide-details
                  clearable
                />
              </v-col>
              <v-col cols="6">
                <v-row>
                  <v-col cols="4">
                    <v-select v-model="toolType" label="Tool Type" :items="types" clearable />
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      v-model="cuttingDia"
                      label="Cutting Dia"
                      clearable
                      @keydown="isNumber($event)"
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      v-model="minFluteLength"
                      label="Min Flute Length"
                      clearable
                      @keydown="isNumber($event)"
                    />
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
            <v-row> </v-row>
          </div>
          <div v-else>
            <v-text-field
              v-model="search"
              label="Search"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              single-line
              hide-details
              clearable
            />
          </div>
        </template>

        <v-data-table
          v-model:page="page"
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="filteredItems"
          :search="search"
          :loading="toolStore.loading"
          @click:row="openTool"
        >
          <template v-slot:[`item.img`]="{ item }">
            <v-img :id="item._id" :src="item.img" class="tool-img"></v-img>
          </template>
          <template v-slot:[`item.location`]="{ item }">
            {{ location(item) }}
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import toolTypes from '@/plugins/toolTypes';
import { isNumber } from '@/plugins/utils';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  title: string;
  headers: { key: string; title?: string }[];
  items: ToolDoc[];
  category: ToolCategory;
  search: string;
}>();

const emits = defineEmits(['updateSearch']);

const toolStore = useToolStore();
const search = ref<string>(props.search);
const page = ref(1);
const itemsPerPage = ref(10);
const cuttingDia = ref<string>();
const minFluteLength = ref<string>();
const toolType = ref<string>();
const resultsTitle = computed(() => {
  let title = props.title;
  if (props.items.length !== filteredItems.value.length)
    title += ` - ${filteredItems.value.length} results`;
  return `${title}`;
});

const types = computed<readonly string[]>(() => {
  return toolTypes[props.category];
});

watch(search, () => {
  emits('updateSearch', search.value);
});

const filteredItems = computed<ToolDoc[]>(() => {
  if (props.category === 'milling') {
    let cuttingDiaNum: number;
    let minFluteLengthNum: number;
    try {
      if (cuttingDia.value) cuttingDiaNum = parseFloat(cuttingDia.value);
      if (minFluteLength.value) minFluteLengthNum = parseFloat(minFluteLength.value);
    } catch (e) {
      return props.items;
    }
    return [...props.items]
      .filter((x) => {
        if (toolType.value) {
          if (toolType.value === x.toolType) return true;
        }
        return !toolType.value;
      })
      .filter((x) => {
        if (Number.isNaN(cuttingDiaNum)) return cuttingDia.value;
        if (cuttingDiaNum && x.cuttingDia) {
          if (cuttingDiaNum > 0 && x.cuttingDia.toString().startsWith(cuttingDiaNum.toString()))
            return true;
        }
        return !cuttingDia.value;
      })
      .filter((x) => {
        if (Number.isNaN(minFluteLengthNum)) return minFluteLength.value;
        if (minFluteLength.value && x.fluteLength) {
          if (minFluteLengthNum > 0 && minFluteLengthNum <= x.fluteLength) return true;
        }
        return !minFluteLength.value;
      });
  }
  return props.items;
});

function openTool(event: unknown, { item }: { item: ToolDoc }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}

watch(page, () => {
  if (page.value === 1) router.push({ name: 'tools' });
  else router.push({ name: 'tools', query: { page: page.value } });
});

watch(itemsPerPage, () => {
  localStorage.setItem('ipp', itemsPerPage.value.toString());
});

onMounted(() => {
  // Do items per page before page number
  const ipp = localStorage.getItem('ipp');
  if (ipp) {
    const ippNum = parseInt(ipp);
    if (!isNaN(ippNum)) itemsPerPage.value = ippNum;
  }

  const tabChanged = toolStore.tabChange;
  if (tabChanged) {
    router.push({ name: 'tools' });
    toolStore.setTabChange(false);
  } else {
    const query = router.currentRoute.value.query;
    if (query.page) {
      const pageNum = parseInt(query.page as string);
      if (!isNaN(pageNum)) page.value = pageNum;
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

function location(tool: ToolDoc): string {
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
</style>

<style>
.highlighted {
  background: #efefef !important;
}
.tool-img {
  max-height: 50px;
}
</style>
