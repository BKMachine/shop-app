<template>
  <v-row>
    <v-col cols="12">
      <v-card>
        <v-card-title class="header my-4"> Stock by location </v-card-title>
        <v-card-text
          ><v-row>
            <v-col cols="6">
              <v-select
                v-model="location"
                :items="toolStore.locations"
                label="Location"
                @update:modelValue="position = ''"
              ></v-select>
            </v-col>
            <v-col cols="6">
              <v-select v-model="position" :items="positions" label="Position"></v-select>
            </v-col>
          </v-row>
          <v-data-table-virtual
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
import { computed, ref } from 'vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const location = ref('');
const position = ref('');

const positions = computed(() => {
  if (!location.value) return [];
  return toolStore.tools
    .filter((x) => x.position && x.location === location.value)
    .map((x) => x.position);
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
</script>

<style scoped>
.stock {
  font-weight: bolder;
  font-size: 1.1em;
}
</style>
