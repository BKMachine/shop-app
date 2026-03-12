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
              <v-row class="mt-4">
                <v-col>
                  <v-text-field
                    :model-value="selectedMaterial.description"
                    label="Description"
                    readonly
                    hint="Auto Generated"
                    class="readonly-field"
                  ></v-text-field>
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="6">
                  <v-select
                    v-model="selectedMaterial.materialType"
                    :items="items"
                    item-title="name"
                    item-value="value"
                    label="Material Type"
                    required
                    hide-details
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
                    hide-details
                  ></v-select>
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Flat'">
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.height"
                    label="Height (inches)"
                    type="number"
                    min="0"
                    required
                    hide-details
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.width"
                    label="Width (inches)"
                    type="number"
                    min="0"
                    required
                    hide-details
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.wallThickness"
                    label="Wall Thickness"
                    type="number"
                    min="0"
                    required
                    hide-details
                    clearable
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Round'">
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.diameter"
                    label="Diameter (inches)"
                    type="number"
                    min="0"
                    required
                    hide-details
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.wallThickness"
                    label="Wall Thickness"
                    type="number"
                    min="0"
                    required
                    hide-details
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.length"
                    label="Length (inches)"
                    type="number"
                    min="0"
                    required
                    hide-details
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col cols="6"> <SupplierSelect v-model="selectedMaterial.supplier" /> </v-col>
              </v-row>

              <v-row>
                <v-col>
                  <v-text-field
                    :model-value="formatCost(selectedMaterial.rate)"
                    label="Cost per Pound (lb)"
                    type="number"
                    prefix="$"
                    @input="onCostInputField($event, 'rate')"
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col>
                  <v-text-field
                    :model-value="formatCost(selectedMaterial.costPerFoot)"
                    label="Cost per Foot"
                    type="number"
                    prefix="$"
                    @input="onCostInputField($event, 'costPerFoot')"
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col>
                  <v-text-field
                    :model-value="formatCost(selectedMaterial.cost)"
                    label="Cost per Bar"
                    type="number"
                    prefix="$"
                    @input="onCostInputField($event, 'cost')"
                    @keydown="onlyAllowNumeric($event)"
                  ></v-text-field>
                </v-col>
                <v-col>
                  <v-text-field
                    :model-value="formatWeight(selectedMaterial.weight)"
                    label="Estimated Weight (lbs)"
                    hint="Auto Generated"
                    class="readonly-field"
                    readonly
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
  wallThickness: null,
  length: 144,
  supplier: '',
  weight: 0,
  rate: 0,
  cost: 0,
  costPerFoot: 0,
};

const items = [
  { props: { header: 'Aluminum' } },
  { name: '6061', value: '6061', density: 0.098 },
  { name: '7075', value: '7075', density: 0.101 },
  { props: { divider: true } },
  { props: { header: 'Steel' } },
  { name: '1018', value: '1018', density: 0.284 },
  { name: '1020', value: '1020', density: 0.284 },
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
  { props: { divider: true } },
  { props: { header: 'Other' } },
  { name: 'Grade 5 Titanium', value: 'Grade 5 Titanium', density: 0.16 },
  { name: 'Brass', value: 'Brass', density: 0.305 },
  { name: 'Bronze', value: 'Bronze', density: 0.32 },
  { name: 'Copper', value: 'Copper', density: 0.32 },
];

const search = ref('');
const selectedMaterial = ref<Material>({ ...defaultMaterial });
const lastCostField = ref<'rate' | 'costPerFoot' | 'cost'>('rate');

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
    materialsStore.add(selectedMaterial.value).then(() => {
      selectedMaterial.value = { ...defaultMaterial };
    });
  } else {
    materialsStore.update(selectedMaterial.value);
  }
}

watch(
  selectedMaterial,
  (newMaterial) => {
    recomputeDescription(newMaterial);
    newMaterial.weight = calcWeight(newMaterial);
    autoCalculateCosts(newMaterial);
  },
  { deep: true },
);

function onCostInputField(event: any, field: 'rate' | 'costPerFoot' | 'cost') {
  // Parse and update the model with full precision, but display with 2 decimals
  const value = parseFloat(event.target.value);
  if (!Number.isNaN(value)) {
    selectedMaterial.value[field] = value;
    lastCostField.value = field;
    autoCalculateCosts(selectedMaterial.value);
  }
}

function formatCost(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(2)).toString();
}

function autoCalculateCosts(material: any) {
  // Avoid recursion by only updating non-last fields
  const weight = material.weight || 0;
  const lengthInFeet = (material.length || 0) / 12;
  if (!weight || !lengthInFeet) {
    material.rate = 0;
    material.costPerFoot = 0;
    material.cost = 0;
    return;
  }
  if (lastCostField.value === 'rate') {
    material.cost = weight * material.rate;
    material.costPerFoot = material.cost / lengthInFeet;
  } else if (lastCostField.value === 'costPerFoot') {
    material.cost = material.costPerFoot * lengthInFeet;
    material.rate = material.cost / weight;
  } else if (lastCostField.value === 'cost') {
    material.rate = material.cost / weight;
    material.costPerFoot = material.cost / lengthInFeet;
  }
}

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
  return volume * density; // Weight in lbs
}

function formatWeight(weight: number | null | undefined): string {
  if (weight == null || Number.isNaN(weight)) return '';
  // Show up to 2 decimals, but no trailing zeros
  return parseFloat(weight.toFixed(2)).toString();
}

// Only allow numbers, decimal, and control keys in numeric fields
function onlyAllowNumeric(e: KeyboardEvent) {
  // Allow: backspace, delete, tab, escape, enter, arrows, home/end, etc.
  if (
    [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ].includes(e.key)
  ) {
    return;
  }
  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
    return;
  }
  // Allow: numbers and decimal point
  if (/^[0-9.]$/.test(e.key)) {
    return;
  }
  // Prevent anything else
  e.preventDefault();
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
