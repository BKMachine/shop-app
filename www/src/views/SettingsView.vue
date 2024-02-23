<template>
  <v-expansion-panels>
    <v-expansion-panel title="Tool Manufacturers">
      <v-expansion-panel-text>
        <ToolBrandSettings />
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
import ToolBrandSettings from '@/components/ToolBrandSettings.vue';
</script>

<style scoped></style>
