<template>
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.customer" />
          Customers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <CustomerSettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.report" />
          Email Reports
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsReport /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-folder-network-outline" />
          Folder Helper
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="helper-actions">
            <p class="helper-copy">
              Install the local Windows helper so the app can open stored UNC part folders with
              Explorer.
            </p>

            <v-chip :color="helperStatusColor" size="small" variant="tonal">
              {{ helperStatusLabel }}
            </v-chip>

            <p v-if="helperVersion" class="helper-meta">
              Latest staged version: {{ helperVersion }}
            </p>

            <div class="helper-buttons">
              <v-btn
                color="primary"
                :href="installerHref"
                prepend-icon="mdi-download"
                rel="noopener noreferrer"
                target="_blank"
              >
                Download Installer
              </v-btn>

              <v-btn
                :disabled="!isWindowsClient"
                :loading="helperCheckPending"
                prepend-icon="mdi-lan-check"
                variant="text"
                @click="checkFolderHelper"
              >
                Check Helper
              </v-btn>
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.supplier" />
          Suppliers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SupplierSettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.shipper" />
          Shippers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <ShipperSettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-tag-multiple-outline" />
          Tool Categories
        </v-expansion-panel-title>
        <v-expansion-panel-text> <ToolCategorySettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.vendor" />
          Vendors
        </v-expansion-panel-title>

        <v-expansion-panel-text> <VendorSettings /> </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import CustomerSettings from '@/components/settings/SettingsCustomer.vue';
import SettingsReport from '@/components/settings/SettingsReport.vue';
import ShipperSettings from '@/components/settings/SettingsShipper.vue';
import SupplierSettings from '@/components/settings/SettingsSupplier.vue';
import ToolCategorySettings from '@/components/settings/SettingsToolCategories.vue';
import VendorSettings from '@/components/settings/SettingsVendor.vue';
import { uiIcons } from '@/lib/uiIcons';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { useFolderHelperState } from '@/state/folderHelper';

const {
  helperCheckPending,
  helperStatusColor,
  helperStatusLabel,
  helperVersion,
  installerHref,
  isWindowsClient,
  loadFolderHelperManifest,
  runFolderHelperPing,
} = useFolderHelperState();

onMounted(async () => {
  try {
    await loadFolderHelperManifest();
  } catch {
    toastError('Unable to load Folder Helper release info.');
  }
});

async function checkFolderHelper() {
  const didLaunch = await runFolderHelperPing();
  if (didLaunch) {
    toastSuccess('Folder Helper responded on this PC.');
    return;
  }

  toastError('Folder Helper was not detected. Install it on this PC.');
}
</script>

<style scoped>
.helper-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.helper-copy,
.helper-meta {
  margin: 0;
}

.helper-meta {
  color: rgb(var(--v-theme-on-surface-variant));
}

.helper-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
