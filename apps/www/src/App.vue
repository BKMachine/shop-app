<template>
  <v-app v-cloak>
    <v-app-bar class="elevation-2">
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-app-bar-title>
        <v-avatar size="48" class="pointer" @click="router.push({ name: 'home' })">
          <v-img src="@/assets/img/bk_logo.png" />
        </v-avatar>
        BK Machine
      </v-app-bar-title>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer">
      <v-list>
        <v-list-item prepend-icon="mdi-apps" link :to="{ name: 'home' }"> Home </v-list-item>
        <v-list-item prepend-icon="mdi-dots-triangle" link :to="{ name: 'parts' }">
          Parts
        </v-list-item>
        <v-list-item prepend-icon="mdi-tools" link :to="{ name: 'tools' }"> Tools </v-list-item>
        <v-list-item prepend-icon="mdi-map-marker" link :to="{ name: 'locations' }">
          Locations
        </v-list-item>
        <v-list-item prepend-icon="mdi-cube-scan" link :to="{ name: 'materials' }">
          Materials
        </v-list-item>
        <v-list-item prepend-icon="mdi-pulse" link :to="{ name: 'status' }"> Status </v-list-item>
      </v-list>
      <template v-slot:append>
        <v-list-item
          v-if="showTestScan"
          prepend-icon="mdi-barcode-scan"
          @click="scannerStore.scan('120850')"
        >
          Test
        </v-list-item>
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
import { computed, onBeforeMount, ref } from 'vue';
import ScanDialog404 from '@/components/scanning/ScanDialog404.vue';
import ScanDialogTool from '@/components/scanning/ScanDialogTool.vue';
import router from '@/router';
import { useCustomerStore } from '@/stores/customer_store';
import { useMaterialsStore } from '@/stores/materials_store';
import { usePartStore } from '@/stores/parts_store';
import { useScannerStore } from '@/stores/scanner_store';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

const customerStore = useCustomerStore();
const materialsStore = useMaterialsStore();
const partStore = usePartStore();
const scannerStore = useScannerStore();
const supplierStore = useSupplierStore();
const toolStore = useToolStore();
const vendorStore = useVendorStore();

// onscan.js by default ignores chars other than alphanumeric
// mappedCodes are chars we do want included in scans
const mappedCodes: { [key: string]: string } = {
  ' ': ' ',
  ':': ':',
  '-': '-',
  '|': '|',
};

// Hardware barcode scanner
onScan.attachTo(document, {
  minLength: 5,
  keyCodeMapper: (e: KeyboardEvent) => {
    return mappedCodes[e.key] || onScan.decodeKeyEvent(e);
  },
});

document.addEventListener('scan', (e) => {
  // Handle Location scans from a QRCode starting with Loc:
  if (e.detail.scanCode.startsWith('Loc:')) {
    const [location, position] = e.detail.scanCode.replace('Loc:', '').split(' | ');
    router.push({ name: 'locations', query: { loc: location, pos: position } });
    return;
  }

  // Handle Tool scans from tool sleeve barcodes
  scannerStore.scan(e.detail.scanCode);
});

const drawer = ref(true);

onBeforeMount(() => {
  customerStore.fetch();
  materialsStore.fetch();
  partStore.fetch();
  supplierStore.fetch();
  vendorStore.fetch();
  toolStore.fetch();
});

const showTestScan = computed<boolean>(() => {
  return location.host.includes('localhost');
});
</script>

<style scoped>
.scan-dialog {
  max-width: 500px;
}
</style>
