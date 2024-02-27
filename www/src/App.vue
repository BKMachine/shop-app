<template>
  <v-app>
    <v-app-bar class="elevation-2">
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title>
        <v-avatar size="48">
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
  </v-app>
</template>

<script setup lang="ts">
import onScan from 'onscan.js';
import { onMounted, ref } from 'vue';
import router from './router';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

onScan.attachTo(document, { minLength: 5 });
document.addEventListener('scan', function (e) {
  const match = toolStore.tools.find((x) => x.item === e.detail.scanCode);
  if (match) {
    router.push({ name: 'viewTool', params: { id: match._id } });
  } else {
    alert('No matching tool was found in the database. Would you like to create one?');
  }
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

<style scoped></style>
