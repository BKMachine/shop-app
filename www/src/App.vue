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
    </v-navigation-drawer>
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const drawer = ref(true);

onMounted(() => {
  toolStore.getManufacturers();
});
</script>

<style scoped></style>
