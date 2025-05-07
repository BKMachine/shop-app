<template>
  <v-select
    label="Supplier"
    :items="supplierStore.suppliers"
    item-title="name"
    item-value="_id"
    clearable
  >
    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <v-avatar rounded="0">
            <v-img class="vendor-logo" :src="item.raw.logo"></v-img>
          </v-avatar>
        </template>
        {{ item.raw.name }}
      </v-list-item>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { useSupplierStore } from '@/stores/supplier_store';

const supplierStore = useSupplierStore();
</script>
