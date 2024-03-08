<template>
  <v-app v-cloak>
    <v-app-bar class="elevation-2">
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title>
        <v-avatar size="48" class="pointer" @click="router.push({ name: 'home' })">
          <v-img src="@/assets/img/bk_logo.png"></v-img>
        </v-avatar>
        BK Machine
      </v-app-bar-title>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer">
      <v-list>
        <v-list-item prepend-icon="mdi-apps" link :to="{ name: 'home' }"> Home </v-list-item>
        <v-list-item prepend-icon="mdi-tools" link :to="{ name: 'tools' }"> Tools </v-list-item>
        <v-list-item prepend-icon="mdi-barcode" @click="scanTest"> Test </v-list-item>
      </v-list>
      <template v-slot:append>
        <v-list-item prepend-icon="mdi-file-document-outline" link :to="{ name: 'toolReport' }">
          Report
        </v-list-item>
        <v-divider />
        <v-list-item prepend-icon="mdi-cog" link to="/settings">Settings</v-list-item>
      </template>
    </v-navigation-drawer>
    <v-main>
      <RouterView />
    </v-main>
    <v-dialog v-model="scannerStore.dialog" class="scan-dialog" opacity="0.65">
      <ScanDialogTool v-if="scannerStore.type === 'tool'" />
      <ScanDialog404 v-else-if="scannerStore.type === '404'" />
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import onScan from 'onscan.js';
import { onBeforeMount, ref } from 'vue';
import ScanDialog404 from '@/components/ScanDialog404.vue';
import ScanDialogTool from '@/components/ScanDialogTool.vue';
import { prefix } from '@/plugins/enums';
import router from '@/router';
import { useCustomerStore } from '@/stores/customer_store';
import { useScannerStore } from '@/stores/scanner_store';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

const customerStore = useCustomerStore();
const scannerStore = useScannerStore();
const supplierStore = useSupplierStore();
const toolStore = useToolStore();
const vendorStore = useVendorStore();

// Hardware barcode scanner
onScan.attachTo(document, { minLength: 5 });
document.addEventListener('scan', function (e) {
  // Do not respond to scanCodes with our custom internal scanCode prefix
  if (e.detail.scanCode.startsWith(prefix)) return;
  // Do not respond to scans if the scan dialog is already open
  if (scannerStore.dialog === true) return;
  scannerStore.setStockAdjustment(0);
  scannerStore.scan(e.detail.scanCode);
});

const drawer = ref(true);

onBeforeMount(() => {
  customerStore.fetch();
  supplierStore.fetch();
  vendorStore.fetch();
  toolStore.fetch();
});

function scanTest() {
  scannerStore.setStockAdjustment(0);
  scannerStore.scan('62147');
}
</script>

<style scoped>
.scan-dialog {
  max-width: 500px;
}
</style>
