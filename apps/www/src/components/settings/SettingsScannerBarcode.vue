<template>
  <v-card class="scanner-barcode-settings" rounded="lg">
    <div class="scanner-barcode-settings__hero">
      <div>
        <h3 class="scanner-barcode-settings__title">Scanner Barcode Settings</h3>
        <p class="scanner-barcode-settings__copy">
          Choose which job page opens after scanning a job barcode on this device.
        </p>
      </div>
    </div>

    <v-radio-group
      v-model="jobScanDestination"
      class="scanner-barcode-settings__group"
      hide-details
    >
      <v-radio label="Job General tab page" value="general" />
      <v-radio label="Job Production tab page" value="production" />
    </v-radio-group>
  </v-card>
</template>

<script setup lang="ts">
import { useJobScanDestination } from '@/state/scannerSettings';

const jobScanDestination = useJobScanDestination;
</script>

<style scoped>
.scanner-barcode-settings {
  padding: 20px;
}

.scanner-barcode-settings__hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.scanner-barcode-settings__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.scanner-barcode-settings__copy {
  margin: 8px 0 0;
}

.scanner-barcode-settings__group {
  margin-top: 16px;
}
</style>
