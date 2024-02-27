<template>
  <v-container>
    <v-row>
      <div class="header">
        <img class="tool-img" :src="tool.img" alt="" />
        <div class="stock-container">
          <div class="stock">
            {{ tool.stock }}
          </div>
          <div>In Stock</div>
        </div>
      </div>
    </v-row>
    <v-divider />
    <v-row class="my-4">
      <v-col cols="12">
        <v-text-field v-model="tool.description" label="Description"></v-text-field>
        <VendorSelect v-model="tool._vendor" />
        <v-text-field
          v-model="tool.item"
          label="Barcode"
          append-inner-icon="mdi-barcode"
        ></v-text-field>
        <v-select v-model="tool.type" label="Type" :items="['Milling', 'Turning']"></v-select>
        <v-text-field v-model.number="tool.stock" label="Stock Qty"></v-text-field>
        <v-text-field v-model="tool.img" label="Tool Image URL"></v-text-field>
      </v-col>
    </v-row>
    <v-divider />
    <v-row>
      <v-btn color="green" variant="outlined" @click="save">Save</v-btn>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VendorSelect from '@/components/VendorSelect.vue';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const tool = ref<Tool>({});

async function save() {
  await toolStore.add(tool.value);
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
