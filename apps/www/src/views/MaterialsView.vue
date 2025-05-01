<template>
  <v-container>
    <!-- Search Bar -->
    <v-text-field
      v-model="search"
      label="Search Materials"
      prepend-inner-icon="mdi-magnify"
      class="mb-4"
    ></v-text-field>

    <!-- Virtualized Data Table -->
    <v-data-table-virtual
      :items="filteredMaterials"
      :headers="headers"
      item-value="id"
      item-title="description"
      @click:row="openMaterialDialog"
    >
      <template #item.description="{ item }">
        {{ item.description }}
      </template>
      <template #item.stock="{ item }"> {{ item.stock }} inches </template>
    </v-data-table-virtual>

    <!-- Material Details Dialog -->
    <v-dialog v-model="dialog" max-width="600px">
      <v-card>
        <v-card-title>
          Material Details
          <v-spacer></v-spacer>
          <v-btn icon @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="form">
            <v-text-field v-model="selectedMaterial.description" label="Description"></v-text-field>
            <v-select
              v-model="selectedMaterial.type"
              :items="['Round', 'Flat']"
              label="Type"
            ></v-select>
            <v-text-field
              v-if="selectedMaterial.type === 'Flat'"
              v-model="selectedMaterial.height"
              label="Height (inches)"
              type="number"
            ></v-text-field>
            <v-text-field
              v-if="selectedMaterial.type === 'Flat'"
              v-model="selectedMaterial.width"
              label="Width (inches)"
              type="number"
            ></v-text-field>
            <v-text-field
              v-if="selectedMaterial.type === 'Round'"
              v-model="selectedMaterial.diameter"
              label="Diameter (inches)"
              type="number"
            ></v-text-field>
            <v-text-field
              v-if="selectedMaterial.type === 'Round'"
              v-model="selectedMaterial.internalDiameter"
              label="Internal Diameter (inches)"
              type="number"
            ></v-text-field>
            <v-text-field
              v-model="selectedMaterial.length"
              label="Length (inches)"
              type="number"
            ></v-text-field>
            <v-text-field
              :value="(selectedMaterial.length / 12).toFixed(2)"
              label="Length (feet)"
              readonly
            ></v-text-field>
            <v-text-field
              v-model="selectedMaterial.materialType"
              label="Material Type (e.g., 6061 Aluminum)"
            ></v-text-field>
            <v-text-field
              v-model="selectedMaterial.location"
              label="Storage Location"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="saveMaterial">Save</v-btn>
          <v-btn color="error" @click="deleteMaterial">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const search = ref('');
const dialog = ref(false);
const selectedMaterial = ref({
  id: null,
  description: '',
  type: 'Round',
  height: null,
  width: null,
  diameter: null,
  internalDiameter: null,
  length: 144,
  materialType: '',
  location: '',
  stock: 0,
});

const materials = ref([
  {
    id: 1,
    description: '6061 Aluminum Round Bar',
    type: 'Round',
    diameter: 2,
    length: 144,
    materialType: '6061 Aluminum',
    location: 'Rack A',
    stock: 500,
  },
  {
    id: 2,
    description: '440 Stainless Steel Flat Bar',
    type: 'Flat',
    height: 1,
    width: 4,
    length: 144,
    materialType: '440 Stainless Steel',
    location: 'Rack B',
    stock: 300,
  },
]);

const headers = [
  { text: 'Description', value: 'description' },
  { text: 'Stock (inches)', value: 'stock' },
];

const filteredMaterials = computed(() =>
  materials.value.filter((material) =>
    material.description.toLowerCase().includes(search.value.toLowerCase()),
  ),
);

function openMaterialDialog(item) {
  selectedMaterial.value = { ...item };
  dialog.value = true;
}

function saveMaterial() {
  if (selectedMaterial.value.id) {
    const index = materials.value.findIndex((m) => m.id === selectedMaterial.value.id);
    if (index !== -1) {
      materials.value[index] = { ...selectedMaterial.value };
    }
  } else {
    selectedMaterial.value.id = Date.now();
    materials.value.push({ ...selectedMaterial.value });
  }
  dialog.value = false;
}

function deleteMaterial() {
  materials.value = materials.value.filter((m) => m.id !== selectedMaterial.value.id);
  dialog.value = false;
}
</script>

<style scoped>
.mb-4 {
  margin-bottom: 16px;
}
</style>
