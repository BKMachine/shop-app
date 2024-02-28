<template>
  <v-app>
    <v-app-bar class="elevation-2">
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title>
        <v-avatar size="48" style="cursor: pointer" @click="router.push('/')">
          <v-img src="@/assets/img/bk_logo.png"></v-img>
        </v-avatar>
        BK Machine
      </v-app-bar-title>
      <v-spacer></v-spacer>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer">
      <v-list>
        <v-list-item prepend-icon="mdi-apps" link to="/"> Home </v-list-item>
        <v-list-item prepend-icon="mdi-tools" link to="/tools"> Tools </v-list-item>
      </v-list>
      <template v-slot:append>
        <v-divider />
        <v-list-item prepend-icon="mdi-cog" link to="/settings">Settings</v-list-item>
      </template>
    </v-navigation-drawer>
    <v-main>
      <RouterView />
    </v-main>
    <v-dialog v-model="showScanDialog" class="scan-dialog">
      <ScanDialogTool
        v-if="scanDialogType === 'tool'"
        :scanCode="scanCode"
        @close="showScanDialog = false"
      />
      <ScanDialog404
        v-else-if="scanDialogType === '404'"
        :scanCode="scanCode"
        @close="showScanDialog = false"
      />
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import onScan from 'onscan.js';
import { onMounted, ref } from 'vue';
import ScanDialog404 from '@/components/ScanDialog404.vue';
import ScanDialogTool from '@/components/ScanDialogTool.vue';
import router from '@/router';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

// Hardware barcode scanner
const scanCode = ref('62147');
const showScanDialog = ref(true);
const scanDialogType = ref<'404' | 'tool'>('tool');
onScan.attachTo(document, { minLength: 5 });
document.addEventListener('scan', function (e) {
  // Don't respond to scans if the scan dialog is already shown
  if (showScanDialog.value === true) return;
  scanCode.value = e.detail.scanCode;
  const toolMatch = toolStore.tools.find((x) => x.item === e.detail.scanCode);
  if (toolMatch) scanDialogType.value = 'tool';
  else scanDialogType.value = '404';
  showScanDialog.value = true;
});

const supplierStore = useSupplierStore();
const vendorStore = useVendorStore();
const toolStore = useToolStore();

const drawer = ref(true);

onMounted(() => {
  supplierStore.fetch();
  vendorStore.fetch();
  toolStore.fetch();
});
</script>

<style scoped>
.scan-dialog {
  max-width: 700px;
}
</style>
