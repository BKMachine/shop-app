<template>
  <v-card>
    <v-card-title class="header">
      <div>Milling Tools</div>
      <div>
        <v-btn
          icon="mdi-file-document-outline"
          class="mr-2"
          link
          :to="{ name: 'toolReport' }"
        ></v-btn>
        <v-btn link :to="{ name: 'createTool' }" color="primary" prepend-icon="mdi-plus">
          Create New Tool
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-card flat>
        <template v-slot:text>
          <v-text-field
            v-model="search"
            label="Search"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
            hide-details
          ></v-text-field>
        </template>

        <v-data-table
          :headers="headers"
          :items="toolStore.millingTools"
          :search="search"
          :loading="toolStore.loading"
          @dblclick:row="openTool"
        >
          <template v-slot:[`item.img`]="{ item }">
            <v-img :src="item.img"></v-img>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
  <!--  <div class="header">
  </div>
  -->
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const search = ref('');
const headers = computed(() => {
  return [
    {
      key: 'img',
    },
    {
      title: 'Description',
      key: 'description',
    },
    {
      title: 'Vendor',
      key: '_vendor.name',
    },
    {
      title: 'Item',
      key: 'item',
    },
    {
      title: 'Coating',
      key: 'coating',
    },
    {
      title: 'Flutes',
      key: 'flutes',
    },
  ];
});

function openTool(event: unknown, { item }: { item: ToolDoc }) {
  router.push({ name: 'viewTool', params: { id: item._id } });
}
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
</style>
