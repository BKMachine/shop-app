<template>
  <v-app v-cloak>
    <v-app-bar class="elevation-2">
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-app-bar-title>
        <v-avatar class="pointer" size="48" @click="router.push({ name: 'home' })">
          <v-img src="@/assets/img/bk_logo.png" />
        </v-avatar>
        BK Machine
      </v-app-bar-title>
      <v-btn
        :aria-label="themeToggleLabel"
        :icon="themeToggleIcon"
        :title="themeToggleLabel"
        variant="text"
        @click="toggleTheme"
      />
    </v-app-bar>
    <v-navigation-drawer v-model="drawer">
      <v-list>
        <v-list-item link prepend-icon="mdi-apps" :to="{ name: 'home' }"> Home </v-list-item>
        <v-list-item link prepend-icon="mdi-shape" :to="{ name: 'parts' }">
          Parts
        </v-list-item>

        <v-list-item link prepend-icon="mdi-tools" :to="{ name: 'tools' }">
          Tools
        </v-list-item>
        <v-list-item link prepend-icon="mdi-map-marker" :to="{ name: 'locations' }">
          Locations
        </v-list-item>
        <v-list-item link prepend-icon="mdi-cube-scan" :to="{ name: 'materials' }">
          Materials
        </v-list-item>
        <v-list-item link prepend-icon="mdi-truck-check-outline" :to="{ name: 'shipments' }">
          Shipments
        </v-list-item>
        <v-list-item link prepend-icon="mdi-pulse" :to="{ name: 'status' }">
          Status
        </v-list-item>
      </v-list>
      <template #append>
        <v-list-item v-if="showDev" link prepend-icon="mdi-test-tube" :to="{name: 'test'}">
          WIP
        </v-list-item>
        <v-list-item
          v-if="showDev"
          prepend-icon="mdi-barcode-scan"
          @click="scannerStore.scan('120850')"
        >
          Test
        </v-list-item>
        <v-list-item
          link
          prepend-icon="mdi-clipboard-text-clock-outline"
          :to="{ name: 'activity' }"
        >
          Activity
        </v-list-item>
        <v-list-item link prepend-icon="mdi-file-document-outline" :to="{ name: 'toolReport' }">
          Report
        </v-list-item>
        <v-divider />
        <v-list-item
          v-if="showAuditTrail"
          link
          prepend-icon="mdi-database-eye-outline"
          :to="{ name: 'auditTrail' }"
        >
          Audit Trail
        </v-list-item>
        <v-list-item link prepend-icon="mdi-cog" to="/settings"> Settings </v-list-item>
      </template>
    </v-navigation-drawer>
    <v-main> <RouterView /> </v-main>
    <v-dialog v-model="scannerStore.dialog" class="scan-dialog" opacity="0.65">
      <ScanDialogTool v-if="scannerStore.type === 'tool'" />
      <ScanDialog404 v-else-if="scannerStore.type === '404'" />
    </v-dialog>
    <DisplayNameDialog />
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import DisplayNameDialog from '@/components/DisplayNameDialog.vue';
import ScanDialog404 from '@/components/scanning/ScanDialog404.vue';
import ScanDialogTool from '@/components/scanning/ScanDialogTool.vue';
import onScan from '@/lib/onscan';
import router from '@/router';
import { deviceState, fetchCurrentDevice } from '@/state/device';
import { useCustomerStore } from '@/stores/customer_store';
import { useMaterialsStore } from '@/stores/materials_store';
import { useScannerStore } from '@/stores/scanner_store';
import { useShipperStore } from '@/stores/shipper_store';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolCategoryStore } from '@/stores/tool_category_store';
import { useVendorStore } from '@/stores/vendor_store';

const customerStore = useCustomerStore();
const materialsStore = useMaterialsStore();
const scannerStore = useScannerStore();
const shipperStore = useShipperStore();
const supplierStore = useSupplierStore();
const toolCategoryStore = useToolCategoryStore();
const vendorStore = useVendorStore();
const theme = useTheme();

const THEME_STORAGE_KEY = 'shop-app-theme';

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
  suffixKeyCodes: [13],
  ignoreIfFocusOn: ['input', 'textarea', 'select'],
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

const isDarkTheme = computed(() => theme.global.name.value === 'dark');

const themeToggleIcon = computed(() => {
  return isDarkTheme.value ? 'mdi-weather-sunny' : 'mdi-weather-night';
});

const themeToggleLabel = computed(() => {
  return isDarkTheme.value ? 'Switch to light mode' : 'Switch to dark mode';
});

function toggleTheme() {
  theme.change(isDarkTheme.value ? 'light' : 'dark');
}

onBeforeMount(() => {
  void customerStore.fetch();
  void materialsStore.fetch();
  void shipperStore.fetch();
  void supplierStore.fetch();
  void toolCategoryStore.fetch();
  void vendorStore.fetch();
  void fetchCurrentDevice();

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    theme.change(storedTheme);
  }
});

watch(
  () => theme.global.name.value,
  (value) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  },
  { immediate: true },
);

const showDev = computed<boolean>(() => {
  return location.host.includes('localhost') || location.host.includes('127.0.0.1');
});

const showAuditTrail = computed<boolean>(() => Boolean(deviceState.current?.isAdmin));
</script>

<style scoped>
.scan-dialog {
  max-width: 500px;
}
</style>
