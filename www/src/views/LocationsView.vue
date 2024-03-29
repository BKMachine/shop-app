<template>
  <v-row>
    <v-col cols="12">
      <v-card>
        <v-card-title class="header my-4 d-flex">
          Stock by Location
          <div v-if="tools.length && location">
            - {{ tools.length }} result{{ tools.length === 1 ? '' : 's' }}
          </div>
          <v-spacer />
          <v-btn :disabled="!printEnabled" :color="printColor" @click="print">
            <v-icon icon="mdi-printer-outline"></v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <v-select
                v-model="location"
                :items="toolStore.locations"
                label="Location"
                @update:modelValue="updateLocation"
              ></v-select>
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="position"
                :items="positions"
                label="Position"
                @update:modelValue="updateQueryString"
              ></v-select>
            </v-col>
          </v-row>
          <v-data-table-virtual
            v-if="tools.length"
            :headers="headers"
            :items="tools"
            :loading="toolStore.loading"
            @click:row="openTool"
          >
            <template v-slot:[`item.img`]="{ item }">
              <v-img :src="item.img" class="tool-img"></v-img>
            </template>

            <template v-slot:[`item.stock`]="{ item }">
              <span class="stock">
                {{ item.stock }}
              </span>
            </template>
          </v-data-table-virtual>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { uniq } from 'lodash';
import { computed, onMounted, ref, watch } from 'vue';
import printer from '@/plugins/printer';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const location = ref('');
const position = ref('');

const positions = computed(() => {
  if (!location.value) return [];
  return uniq(
    toolStore.tools
      .filter((x) => x.position && x.location === location.value)
      .map((x) => x.position)
      .sort((a, b) => {
        const c = (a as string).toLowerCase();
        const d = (b as string).toLowerCase();
        if (c < d) return -1;
        else if (c > d) return 1;
        else return 0;
      }),
  );
});

const tools = computed(() => {
  if (!location.value) return [];
  let filteredLocation = toolStore.tools.filter((x) => x.location === location.value);
  if (position.value)
    filteredLocation = filteredLocation.filter((x) => x.position === position.value);
  return filteredLocation;
});

const headers = [
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
  },
];

function openTool(event: unknown, { item }: { item: ToolDoc }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}

function updateQueryString() {
  router.push({
    name: 'locations',
    query: { loc: location.value, pos: position.value },
  });
}

function updateLocation() {
  position.value = '';
  updateQueryString();
}

const query = computed(() => {
  return router.currentRoute.value.query;
});

onMounted(setSelectFields);
watch(query, setSelectFields);

function setSelectFields() {
  const { loc, pos } = router.currentRoute.value.query;
  if (loc) location.value = loc as string;
  if (pos) position.value = pos as string;
}

async function print() {
  await printer
    .printLocation({ loc: location.value, pos: position.value })
    .then(() => {
      flashPrintColor('#57a03c');
    })
    .catch(() => {
      flashPrintColor('#be3c3c');
    });
}

const printColorIdle = '#aa60c3';
const printColor = ref(printColorIdle);
function flashPrintColor(color: string) {
  printColor.value = color;
  setTimeout(() => {
    printColor.value = printColorIdle;
  }, 1500);
}

const printEnabled = computed(() => {
  return location.value && position.value;
});
</script>

<style scoped>
.stock {
  font-weight: bolder;
  font-size: 1.1em;
}
</style>
