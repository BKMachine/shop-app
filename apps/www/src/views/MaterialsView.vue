<template>
  <v-container>
    <v-row>
      <!-- Left Column: Material List -->
      <v-col cols="4">
        <v-text-field
          v-model="search"
          label="Search Materials"
          prepend-inner-icon="mdi-magnify"
          class="mb-0"
          clearable
          @click:clear="search = ''"
        ></v-text-field>

        <v-list>
          <v-list-item
            v-for="material in filteredMaterials"
            :key="material._id"
            class="mb-2"
            :class="{ 'selected-item': material._id === selectedMaterial._id }"
            @click="selectMaterial(material)"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{ material.description }}
              </v-list-item-title>
              <v-list-item-subtitle class="d-flex align-center">
                {{ material.type }} - {{ material.materialType }}
                <v-spacer></v-spacer>
                <div v-if="material.type === 'Flat'">
                  {{ material.height }} x {{ material.width }}
                </div>
                <div v-else-if="material.type === 'Round'">{{ material.diameter }} ⌀</div>
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-col>

      <!-- Right Column: Material Details -->
      <v-col cols="8">
        <v-card>
          <v-card-title class="d-flex align-center">
            Material Details
            <v-spacer />
            <v-btn color="primary" @click="addNewMaterial">Add New</v-btn>
          </v-card-title>
          <v-card-text>
            <v-form ref="form">
              <v-text-field
                v-model="selectedMaterial.description"
                label="Description"
                readonly
                disabled
              ></v-text-field>

              <v-row>
                <v-col cols="6">
                  <v-select
                    v-model="selectedMaterial.materialType"
                    :items="items"
                    item-title="name"
                    item-value="value"
                    label="Material Type"
                    required
                  >
                    <template #item="data">
                      <v-list-item v-if="data.props.header">
                        {{ data.props.header }}
                      </v-list-item>
                      <v-divider v-else-if="data.props.divider" />
                      <v-list-subheader v-else v-bind="data.props" class="material-select-item">
                        {{ data.item.value }}
                      </v-list-subheader>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="6">
                  <v-select
                    v-model="selectedMaterial.type"
                    :items="['Flat', 'Round']"
                    label="Type"
                    required
                  ></v-select>
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Flat'">
                <v-col cols="4">
                  <v-text-field
                    v-model="selectedMaterial.height"
                    label="Height (inches)"
                    type="number"
                    min="0"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model="selectedMaterial.width"
                    label="Width (inches)"
                    type="number"
                    min="0"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model="selectedMaterial.wallThickness"
                    label="Wall Thickness"
                    type="number"
                    min="0"
                    required
                  ></v-text-field>
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Round'">
                <v-col cols="6">
                  <v-text-field
                    v-model="selectedMaterial.diameter"
                    label="Diameter (inches)"
                    type="number"
                    min="0"
                    required
                  ></v-text-field
                ></v-col>
                <v-col cols="6"
                  ><v-text-field
                    v-model="selectedMaterial.wallThickness"
                    label="Wall Thickness"
                    type="number"
                    min="0"
                    required
                  ></v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="selectedMaterial.length"
                    label="Length (inches)"
                    type="number"
                    min="0"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="6">
                  <SupplierSelect v-model="selectedMaterial.supplier" />
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="green" variant="elevated" @click="saveMaterial">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import SupplierSelect from '@/components/SupplierSelect.vue';
import { useMaterialsStore } from '@/stores/materials_store';

const materialsStore = useMaterialsStore();

const defaultMaterial: Material = {
  _id: '0',
  description: '',
  materialType: '',
  type: 'Flat',
  height: null,
  width: null,
  diameter: null,
  wallThickness: 0,
  length: 144,
  supplier: '',
};

const items = [
  { props: { header: 'Aluminum' } },
  { name: '6061', value: '6061' },
  { name: '7075', value: '7075' },
  { props: { divider: true } },
  { props: { header: 'Steel' } },
  { name: '1018', value: '1018' },
  { name: '4140', value: '4140' },
  { name: '4130', value: '4130' },
  { props: { divider: true } },
  { props: { header: 'Stainless Steel' } },
  { name: '303', value: '303' },
  { name: '304', value: '304' },
  { name: '316', value: '316' },
  { name: '17-4PH', value: '17-4PH' },
  { name: '420', value: '420' },
  { name: '440C', value: '440C' },
];

const search = ref('');
const selectedMaterial = ref<Material>({ ...defaultMaterial });

const materials = computed(() => materialsStore.materials);

onMounted(() => {
  materialsStore.fetch();
});

const filteredMaterials = computed(() =>
  materials.value.filter((material) =>
    material.description.toLowerCase().includes(search.value.toLowerCase()),
  ),
);

function selectMaterial(material: Material) {
  selectedMaterial.value = { ...material };
}

function addNewMaterial() {
  selectedMaterial.value = { ...defaultMaterial };
}

function saveMaterial() {
  if (selectedMaterial.value._id === '0') {
    materialsStore.add(selectedMaterial.value);
  } else {
    materialsStore.update(selectedMaterial.value);
  }
}

watch(
  selectedMaterial,
  (newMaterial) => {
    recomputeDescription(newMaterial);
  },
  { deep: true },
);

function recomputeDescription(material: Material) {
  if (!material.type || !material.materialType) {
    material.description = '';
    return;
  }

  const type = material.wallThickness ? 'Tubing' : 'Bar';

  if (material.type === 'Flat') {
    const materialInfo = material.wallThickness
      ? `${material.height}" x ${material.width}" x ${material.wallThickness}"`
      : `${material.height}" x ${material.width}"`;

    material.description = `${material.materialType} Flat ${type} - ${materialInfo}`;
  } else if (material.type === 'Round') {
    const diameterInfo = material.wallThickness
      ? `${material.diameter}" ⌀ x ${material.wallThickness}"`
      : `${material.diameter}" ⌀`;

    material.description = `${material.materialType} Round ${type} - ${diameterInfo}`;
  } else {
    material.description = `${material.materialType}`;
  }
}
</script>

<style scoped>
.selected-item {
  background-color: #e3f2fd;
}
.material-select-item {
  cursor: pointer;
}
.material-select-item:hover {
  background-color: #e3f2fd;
}
</style>
