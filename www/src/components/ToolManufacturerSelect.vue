<template>
  <v-select label="Brand" :items="toolStore.manufacturersSorted">
    <!--    <template v-slot:item="{ props, item }">
      <v-list-item v-bind="props">
        <v-avatar>
          <v-img :src="item.raw.logo"></v-img>
        </v-avatar>
        {{ item.raw.name }}
      </v-list-item>
    </template>-->
  </v-select>
</template>

<script setup lang="ts">
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
</script>

<style scoped></style>
