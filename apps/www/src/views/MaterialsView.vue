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
              <v-list-item-title>{{ material.description }}</v-list-item-title>
              <v-list-item-subtitle class="d-flex align-center">
                {{ material.type }}- {{ material.materialType }}
                <v-spacer></v-spacer>
                <div v-if="material.type === 'Flat'">
                  {{ material.height }}x {{ material.width }}
                </div>
                <div v-else-if="material.type === 'Round'">{{ material.diameter }}⌀</div>
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
                      <v-list-item v-if="data.props.header">{{ data.props.header }}</v-list-item>
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
                  ></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field
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
                <v-col cols="6"> <SupplierSelect v-model="selectedMaterial.supplier" /> </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-text-field
                    v-model.number="selectedMaterial.rate"
                    label="Cost per Pound"
                    type="number"
                    prefix="$"
                  ></v-text-field>
                </v-col>
                <v-col>
                  <v-text-field
                    v-model="selectedMaterial.weight"
                    label="Estimated Weight (lbs)"
                    type="number"
                    disabled
                  ></v-text-field>
                </v-col>
                <v-col>
                  <v-text-field
                    v-model.number="selectedMaterial.cost"
                    label="Estimated Cost"
                    type="number"
                    disabled
                    prefix="$"
                  ></v-text-field>
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
import { computed, onMounted, ref, watch } from 'vue';
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
  weight: null,
  rate: 0,
  cost: 0,
};

const items = [
  { props: { header: 'Aluminum' } },
  { name: '6061', value: '6061', density: 0.098 },
  { name: '7075', value: '7075', density: 0.101 },
  { props: { divider: true } },
  { props: { header: 'Steel' } },
  { name: '1018', value: '1018', density: 0.284 },
  { name: '4140', value: '4140', density: 0.284 },
  { name: '4130', value: '4130', density: 0.284 },
  { props: { divider: true } },
  { props: { header: 'Stainless Steel' } },
  { name: '303', value: '303', density: 0.284 },
  { name: '304', value: '304', density: 0.284 },
  { name: '316', value: '316', density: 0.284 },
  { name: '17-4PH', value: '17-4PH', density: 0.284 },
  { name: '420', value: '420', density: 0.284 },
  { name: '440C', value: '440C', density: 0.284 },
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
    newMaterial.weight = calcWeight(newMaterial);
    newMaterial.cost =
      newMaterial.weight && newMaterial.rate ? newMaterial.weight * newMaterial.rate : 0;
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

function calcWeight(selectedMaterial: Material) {
  const materialInfo = items.find((item) => item.value === selectedMaterial.materialType);
  if (!materialInfo) return 0;

  const density = materialInfo.density || 0; // lbs/in³

  let volume = 0; // in³
  const height = selectedMaterial.height || 0;
  const width = selectedMaterial.width || 0;
  const diameter = selectedMaterial.diameter || 0;
  const wallThickness = selectedMaterial.wallThickness || 0;
  const length = selectedMaterial.length || 0;

  if (selectedMaterial.type === 'Flat') {
    if (wallThickness > 0) {
      // Tubing: Calculate outer volume and subtract inner volume
      const outerVolume = height * width * length;
      const innerVolume = (height - 2 * wallThickness) * (width - 2 * wallThickness) * length;
      volume = outerVolume - innerVolume;
    } else {
      // Bar: Simple rectangular volume
      volume = height * width * length;
    }
  } else if (selectedMaterial.type === 'Round') {
    const radius = diameter / 2;
    if (wallThickness > 0) {
      // Tubing: Calculate outer volume and subtract inner volume
      const outerVolume = Math.PI * radius ** 2 * length;
      const innerRadius = radius - wallThickness;
      const innerVolume = Math.PI * innerRadius ** 2 * length;
      volume = outerVolume - innerVolume;
    } else {
      // Bar: Simple cylindrical volume
      volume = Math.PI * radius ** 2 * length;
    }
  }
  return Math.round(volume * density); // Weight in lbs
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
