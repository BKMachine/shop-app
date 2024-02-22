<template>
  <v-select label="Brand" :items="toolStore.manufacturersSorted" item-title="name" item-value="_id">
    <template v-slot:item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template v-slot:prepend>
          <v-avatar><v-img :src="item.raw.logo"></v-img></v-avatar>
        </template>

        {{ item.raw.name }}
      </v-list-item>
    </template>

    <template v-slot:prepend-item>
      <v-divider class="mb-2"></v-divider>

      <v-list-item disabled>
        <template v-slot:prepend>
          <v-spacer></v-spacer>
          <v-btn>New</v-btn>
        </template>
      </v-list-item>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
</script>

<style scoped></style>
