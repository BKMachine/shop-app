<template>
  <v-select label="Brand" :items="toolStore.sorted" item-title="name" item-value="_id">
    <template v-slot:item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template v-slot:prepend>
          <v-avatar rounded="0"><v-img class="logo" :src="item.raw.logo"></v-img></v-avatar>
        </template>

        {{ item.raw.name }}
      </v-list-item>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { useVendorStore } from '@/stores/vendor_store';

const toolStore = useVendorStore();
</script>

<style scoped>
.logo {
  width: 100%;
}
</style>
