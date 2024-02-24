<template>
  <v-app>
    <v-app-bar class="elevation-2">
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title>
        <v-avatar>
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
import axios from '@/plugins/axios';
import { useSupplierStore } from '@/stores/supplier_store';
import { useVendorStore } from '@/stores/vendor_store';

const supplierStore = useSupplierStore();
const vendorStore = useVendorStore();

const drawer = ref(true);

onMounted(() => {
  supplierStore.fetch();
  vendorStore.fetch();
  onScan.attachTo(document);
});

document.addEventListener('scan', function (e) {
  axios.post('/scan', { query: e.detail.scanCode }).then(({ data }) => {
    console.log(data);
    router.push({ name: 'createTool', params: { id: e.detail.scanCode } });
  });
});
</script>

<style scoped></style>
