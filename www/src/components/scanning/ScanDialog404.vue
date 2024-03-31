<template>
  <v-card>
    <v-card-title class="title-404">
      <v-icon class="mr-2" color="red" icon="mdi-alert" />
      Not Found
    </v-card-title>
    <v-card-text>
      No items were found with the scan code:
      <span class="scan-code">
        {{ scannerStore.code }}
      </span>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn variant="elevated" @click="copyToClipboard">
        <v-icon icon="mdi-content-copy" />
      </v-btn>
      <v-btn color="primary" variant="elevated" @click="scannerStore.showDialog(false)"> OK </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { toastSuccess } from '@/plugins/vue-toast-notification';
import { useScannerStore } from '@/stores/scanner_store';

const scannerStore = useScannerStore();

function copyToClipboard() {
  navigator.clipboard.writeText(scannerStore.code);
  toastSuccess('Copied to clipboard');
}
</script>

<style scoped>
.title-404 {
  display: flex;
  align-items: center;
}
.scan-code {
  font-weight: bolder;
}
</style>
