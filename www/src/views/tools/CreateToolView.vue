<template>
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
    <v-row>
      <v-text-field v-model="tool.description" label="Name"></v-text-field>
      <ToolManufacturerSelect v-model="tool.manufacturer" />
      <v-text-field v-model="tool.item" label="Item No."></v-text-field>
    </v-row>
    <v-row> </v-row>
    <v-row>
      <div style="display: flex; align-items: center">
        <v-btn color="orange" append-icon="mdi-open-in-new" @click="openNewTab(tool.productPage)">
          Product Page
        </v-btn>
        <v-icon color="blue" icon="mdi-pencil-outline" small></v-icon>
      </div>
      <v-text-field label="Location"></v-text-field>
      <v-text-field label="Sub Location"></v-text-field>
      <v-text-field label="Coating"></v-text-field>
      <v-text-field v-model="tool.price" label="Cost"></v-text-field>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ToolManufacturerSelect from '@/components/ToolManufacturerSelect.vue';

const tool = ref<Tool>({
  description: '1/2x3" SQ 3FL 1-1/4" F/L',
  item: '07096',
  manufacturer: 'Garr',
  vendor: 'Black Hawk',
  stock: 14,
  img: 'https://www.garrtool.com/product-images/A3.PNG',
  productPage: 'https://www.garrtool.com/product-details/?EDP=07096',
  price: '$55.26',
  location: 'Blue Lista',
  subLocation: 'A7',
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
.tool-img {
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
