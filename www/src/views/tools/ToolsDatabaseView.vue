<template>
  <v-tabs v-model="tab" bg-color="primary" align-tabs="center" grow>
    <v-tab value="milling">Milling</v-tab>
    <v-tab value="turning">Turning</v-tab>
  </v-tabs>

  <v-window v-model="tab">
    <v-window-item value="milling"> <MillingToolsDataTable /> </v-window-item>

    <v-window-item value="turning"> Turning </v-window-item>
  </v-window>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MillingToolsDataTable from '@/components/MillingToolsDataTable.vue';

const tab = ref('milling');
</script>

<style scoped></style>
