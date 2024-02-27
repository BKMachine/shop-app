<template>
  <v-card>
    <v-card-title class="header">
      Milling Tools
      <v-btn link to="/tools/database/create" color="primary" prepend-icon="mdi-plus">
        Create New Tool
      </v-btn>
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
        >
          <template v-slot:item.img="{ item }">
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
      align: 'start',
      key: 'description',
    },
    {
      title: 'Vendor',
      align: 'start',
      key: '_vendor.name',
    },
    {
      title: 'Item',
      align: 'start',
      key: 'item',
    },
  ];
});
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
}
</style>
