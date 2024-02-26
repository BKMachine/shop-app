<template>
  <v-container>
    <div class="header">
      <img class="tool-img" :src="tool.img" alt="" />
      <div class="stock-container">
        <div class="stock">
          {{ tool.stock }}
        </div>
        <div>In Stock</div>
      </div>
      <!--    <div>{{ tool.location }} - {{ tool.subLocation }}</div>-->
    </div>
    <div>
      <v-divider />
      <v-row>
        <v-col cols="8">
          <v-row class="mt-4">
            <v-col cols="5">
              <v-text-field v-model="tool.description" label="Description"></v-text-field>
            </v-col>
            <v-col cols="7" style="display: flex; flex-direction: row">
              <VendorSelect v-model="tool.vendor" />
              <v-text-field v-model="tool.item" label="Item No."></v-text-field>
            </v-col>
          </v-row>
          <v-row> </v-row>
          <v-row>
            <v-text-field label="Location"></v-text-field>
            <v-text-field label="Sub Location"></v-text-field>
            <v-text-field label="Coating"></v-text-field>
            <v-text-field label="Cost"></v-text-field>
          </v-row>
          <v-row>
            <div style="display: flex; align-items: center">
              <v-btn color="orange" append-icon="mdi-open-in-new"> Product Page </v-btn>
              <v-icon color="blue" icon="mdi-pencil-outline" small></v-icon>
            </div>
          </v-row>
        </v-col>
        <v-col cols="4"> </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VendorSelect from '@/components/VendorSelect.vue';

const tool = ref<Tool>({
  description: '1/2x3" SQ 3FL 1-1/4" F/L',
  vendor: { _id: '123456', name: 'Garr' },
  item: '07096',
  stock: 14,
  img: 'https://www.garrtool.com/product-images/A3.PNG',
});

function openNewTab(url: string) {
  window.open(url, '_blank');
}
</script>

<style scoped>
.header {
  height: 160px;
  display: flex;
  justify-content: space-between;
  padding: 20px;
}
.stock-container {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 120px;
  height: 120px;
  flex-direction: column;
}
.stock {
  font-weight: bolder;
  font-size: 3em;
}
</style>
