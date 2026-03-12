<template>
  <v-container>
    <v-row>
      <!-- Left Column: Material List -->
      <v-col cols="4">
        <v-text-field
          v-model="search"
          class="mb-0"
          clearable
          label="Search Materials"
          prepend-inner-icon="mdi-magnify"
          @click:clear="search = ''"
        />
        <div class="d-flex mb-2 align-center" style="gap: 8px;">
          <v-btn-toggle v-model="typeFilter" dense mandatory>
            <v-btn size="small" value="All">All</v-btn>
            <v-btn size="small" value="Flat">Flat</v-btn>
            <v-btn size="small" value="Round">Round</v-btn>
          </v-btn-toggle>
          <v-btn-toggle v-model="tubingFilter" dense mandatory>
            <v-btn size="small" value="All">All</v-btn>
            <v-btn size="small" value="Tubing">Tubing</v-btn>
            <v-btn size="small" value="Bar">Bar</v-btn>
          </v-btn-toggle>
        </div>

        <v-list class="materials-list" density="compact" nav>
          <v-list-item
            v-for="material in sortedFilteredMaterials"
            :key="material._id"
            :active="material._id === selectedMaterial._id"
            class="material-row"
            @click="selectMaterial(material)"
          >
            <v-list-item-title class="material-title">
              {{ formatMaterialTitle(material) }}
            </v-list-item-title>

            <v-list-item-subtitle class="material-subtitle">
              {{ formatMaterialSize(material) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>

      <!-- Right Column: Material Details -->
      <v-col cols="8">
        <v-form ref="form" v-model="formValid">
          <v-card>
            <v-card-title class="d-flex align-center">
              Material Details
              <v-spacer />
              <v-btn color="primary" @click="addNewMaterial"> Add New </v-btn>
            </v-card-title>
            <v-card-text>
              <v-row class="mt-4">
                <v-col>
                  <v-text-field
                    class="readonly-field"
                    hint="Auto Generated"
                    label="Description"
                    :model-value="selectedMaterial.description"
                    readonly
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="6">
                  <v-select
                    v-model="selectedMaterial.materialType"
                    hide-details
                    item-title="name"
                    item-value="value"
                    :items="items"
                    label="Material Type"
                    required
                  >
                    <template #item="data">
                      <v-list-item v-if="data.props.header"> {{ data.props.header }} </v-list-item>
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
                    hide-details
                    :items="['Flat', 'Round']"
                    label="Type"
                    required
                  />
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Flat'">
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.height"
                    hide-details
                    label="Height (inches)"
                    min="0"
                    required
                    :rules="[numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.width"
                    hide-details
                    label="Width (inches)"
                    min="0"
                    required
                    :rules="[numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.wallThickness"
                    clearable
                    hide-details
                    label="Wall Thickness"
                    min="0"
                    required
                    :rules="[numberOptionalRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Round'">
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.diameter"
                    hide-details
                    label="Diameter (inches)"
                    min="0"
                    required
                    :rules="[numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.wallThickness"
                    hide-details
                    label="Wall Thickness"
                    min="0"
                    required
                    :rules="[numberOptionalRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.length"
                    hide-details
                    label="Length (inches)"
                    min="0"
                    required
                    :rules="[numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="6">
                  <SupplierSelect v-model="selectedMaterial.supplier" :rules="[requiredRule]" />
                </v-col>
              </v-row>

              <v-row>
                <v-col>
                  <v-text-field
                    label="Cost per Pound (lb)"
                    :model-value="formatCost(selectedMaterial.rate)"
                    prefix="$"
                    :rules="[numberRequiredRule]"
                    type="number"
                    @input="onCostInputField($event, 'rate')"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    label="Cost per Foot"
                    :model-value="formatCost(selectedMaterial.costPerFoot)"
                    prefix="$"
                    :rules="[numberRequiredRule]"
                    type="number"
                    @input="onCostInputField($event, 'costPerFoot')"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    label="Cost per Bar"
                    :model-value="formatCost(selectedMaterial.cost)"
                    prefix="$"
                    :rules="[numberRequiredRule]"
                    type="number"
                    @input="onCostInputField($event, 'cost')"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    class="readonly-field"
                    hint="Auto Generated"
                    label="Estimated Weight (lbs)"
                    :model-value="formatWeight(selectedMaterial.weight)"
                    readonly
                  />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="green"
                :disabled="!formValid"
                variant="elevated"
                @click="validateAndSave"
              >
                Save
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-form>
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
  supplier: undefined,
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
const formValid = ref(true);
const typeFilter = ref<'All' | 'Flat' | 'Round'>('All');
const tubingFilter = ref<'All' | 'Tubing' | 'Bar'>('All');

const materials = computed(() => materialsStore.materials);

onMounted(() => {
  materialsStore.fetch();
});

const sortedFilteredMaterials = computed(() => {
  const q = search.value.trim().toLowerCase();

  return [...materials.value]
    .filter((material) => {
      // Search filter
      if (
        q &&
        ![
          material.description,
          material.materialType,
          material.type,
          formatMaterialTitle(material),
          formatMaterialSize(material),
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      ) {
        return false;
      }
      // Type filter
      if (typeFilter.value !== 'All' && material.type !== typeFilter.value) return false;
      // Tubing/Bar filter
      if (tubingFilter.value !== 'All') {
        const isTubing = !!material.wallThickness;
        if (tubingFilter.value === 'Tubing' && !isTubing) return false;
        if (tubingFilter.value === 'Bar' && isTubing) return false;
      }
      return true;
    })
    .sort((a, b) => compareMaterials(a, b));
});

function compareMaterials(a: Material, b: Material) {
  const materialCompare = (a.materialType || '').localeCompare(b.materialType || '');
  if (materialCompare !== 0) return materialCompare;

  const typeOrder: Record<string, number> = { Flat: 0, Round: 1 };
  const typeCompare = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
  if (typeCompare !== 0) return typeCompare;

  const aDims = getSortDimensions(a);
  const bDims = getSortDimensions(b);

  for (let i = 0; i < Math.max(aDims.length, bDims.length); i++) {
    const diff = (aDims[i] ?? 0) - (bDims[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return (a.description || '').localeCompare(b.description || '');
}

function getSortDimensions(material: Material): number[] {
  const length = material.length ?? 0;
  const wall = material.wallThickness ?? 0;

  if (material.type === 'Flat') {
    const h = material.height ?? 0;
    const w = material.width ?? 0;
    const small = Math.min(h, w);
    const large = Math.max(h, w);
    return [small, large, wall, length];
  }

  if (material.type === 'Round') {
    const d = material.diameter ?? 0;
    return [d, wall, length];
  }

  return [length];
}

function formatNumber(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(3)).toString();
}

function formatMaterialTitle(material: Material): string {
  const type = material.wallThickness ? 'Tubing' : 'Bar';
  return `${material.materialType} ${material.type} ${type}`;
}

function formatMaterialSize(material: Material): string {
  const length = material.length ? ` × ${formatNumber(material.length)}` : '';

  if (material.type === 'Flat') {
    const h = formatNumber(material.height);
    const w = formatNumber(material.width);
    const wall = material.wallThickness ? ` × ${formatNumber(material.wallThickness)} wall` : '';
    return `${h} × ${w}${wall}${length}`;
  }

  if (material.type === 'Round') {
    const d = formatNumber(material.diameter);
    const wall = material.wallThickness ? ` × ${formatNumber(material.wallThickness)} wall` : '';
    return `Ø${d}${wall}${length}`;
  }

  return '';
}

function selectMaterial(material: Material) {
  selectedMaterial.value = { ...material };
}

function addNewMaterial(this: any) {
  selectedMaterial.value = { ...defaultMaterial };
  this.$refs.form.resetValidation();
}

function validateAndSave(this: any) {
  this.$refs.form.validate();
  if (!formValid.value) return;
  saveMaterial();
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

const requiredRule = (v: any) => (v !== null && v !== undefined && v !== '') || 'Required';

const numberRequiredRule = (v: any) =>
  (v !== null && v !== undefined && !Number.isNaN(v) && v !== '') ||
  'Required and must be a valid number';

const numberOptionalRule = (v: any) =>
  v === null ||
  v === undefined ||
  v === '' ||
  (!Number.isNaN(v) && Number(v) >= 0) ||
  'Must be a valid number';

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

  const density = materialInfo.density || 0;

  let volume = 0;
  const height = selectedMaterial.height || 0;
  const width = selectedMaterial.width || 0;
  const diameter = selectedMaterial.diameter || 0;
  const wallThickness = selectedMaterial.wallThickness || 0;
  const length = selectedMaterial.length || 0;

  if (selectedMaterial.type === 'Flat') {
    if (wallThickness > 0) {
      const outerVolume = height * width * length;
      const innerVolume = (height - 2 * wallThickness) * (width - 2 * wallThickness) * length;
      volume = outerVolume - innerVolume;
    } else {
      volume = height * width * length;
    }
  } else if (selectedMaterial.type === 'Round') {
    const radius = diameter / 2;
    if (wallThickness > 0) {
      const outerVolume = Math.PI * radius ** 2 * length;
      const innerRadius = radius - wallThickness;
      const innerVolume = Math.PI * innerRadius ** 2 * length;
      volume = outerVolume - innerVolume;
    } else {
      volume = Math.PI * radius ** 2 * length;
    }
  }

  return volume * density;
}

function formatWeight(weight: number | null | undefined): string {
  if (weight == null || Number.isNaN(weight)) return '';
  return parseFloat(weight.toFixed(2)).toString();
}

function onlyAllowNumeric(e: KeyboardEvent) {
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

  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
    return;
  }

  if (/^[0-9.]$/.test(e.key)) {
    return;
  }

  e.preventDefault();
}
</script>

<style scoped>
.materials-list {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}

.material-row {
  min-height: 48px !important;
  padding-top: 4px;
  padding-bottom: 4px;
  border-radius: 6px;
}

.material-title {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-subtitle {
  font-size: 0.8rem;
  line-height: 1rem;
  color: rgb(var(--v-theme-on-surface), 0.7);
}

.selected-item,
.v-list-item--active {
  background-color: #e3f2fd;
}

.material-select-item {
  cursor: pointer;
}
</style>
