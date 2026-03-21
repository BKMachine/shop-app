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
              <v-btn
                class="ml-2"
                color="primary"
                variant="outlined"
                @click="pdfReviewDialog = true"
              >
                Import PDF
              </v-btn>
            </v-card-title>
            <v-card-text>
              <v-row class="mt-4">
                <v-col>
                  <v-text-field
                    class="readonly-field"
                    hint="Auto Generated"
                    label="Description"
                    :model-value="description"
                    readonly
                  />
                </v-col>
                <v-col cols="4">
                  <div class="text-end"><MaterialSketch :material="selectedMaterial" /></div>
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="6">
                  <v-select
                    v-model="selectedMaterial.materialType"
                    :disabled="!isNewMaterial"
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
                    :disabled="!isNewMaterial"
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
                    :disabled="!isNewMaterial"
                    hide-details
                    label="Height (inches)"
                    min="0"
                    required
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.width"
                    :disabled="!isNewMaterial"
                    hide-details
                    label="Width (inches)"
                    min="0"
                    required
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="selectedMaterial.wallThickness"
                    clearable
                    :disabled="!isNewMaterial"
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
                    :disabled="!isNewMaterial"
                    hide-details
                    label="Diameter (inches)"
                    min="0"
                    required
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="selectedMaterial.wallThickness"
                    :disabled="!isNewMaterial"
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
                    :rules="[requiredRule, numberRequiredRule]"
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
                    :disabled="!weight"
                    label="Cost per Pound (lbs)"
                    :model-value="formatCost(costPerPound)"
                    prefix="$"
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @input="onCostInputField($event, 'costPerPound')"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    :disabled="!weight"
                    label="Cost per Foot (ft)"
                    :model-value="formatCost(selectedMaterial.costPerFoot)"
                    prefix="$"
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @input="onCostInputField($event, 'costPerFoot')"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    :disabled="!weight"
                    label="Cost per Bar (ea)"
                    :model-value="formatCost(costPerBar)"
                    prefix="$"
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @input="onCostInputField($event, 'costPerBar')"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    class="readonly-field"
                    hint="Auto Generated"
                    label="Estimated Weight (lbs)"
                    :model-value="formatWeight(weight)"
                    readonly
                  />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-alert
                v-if="existsInStore && isNewMaterial"
                density="compact"
                icon="mdi-alert-circle-outline"
                text="This material already exists."
                type="error"
                variant="tonal"
              />
              <v-btn
                color="green"
                :disabled="!formValid || (existsInStore && isNewMaterial) || !materialChanged"
                variant="elevated"
                @click="saveMaterial"
              >
                Save
              </v-btn>
            </v-card-actions>
          </v-card>

          <v-dialog v-model="pdfReviewDialog" :max-width="pdfReviewDialogMaxWidth" scrollable>
            <v-card>
              <v-card-title class="d-flex align-center">
                Material PDF Review
                <v-spacer />
                <v-btn
                  density="comfortable"
                  icon="mdi-close"
                  variant="text"
                  @click="pdfReviewDialog = false"
                />
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <MaterialPdfReview @has-preview-change="onPdfReviewHasPreviewChange" />
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import {
  calculateMaterialWeight,
  materials as materialsList,
  normalizeDimensions,
} from '@repo/utilities/materials';
import isEqual from 'lodash/isEqual';
import { computed, onMounted, ref, watch } from 'vue';
import MaterialPdfReview from '@/components/MaterialPdfReview.vue';
import MaterialSketch from '@/components/MaterialSketch.vue';
import SupplierSelect from '@/components/SupplierSelect.vue';
import { formatCost, formatNumber, formatWeight, onlyAllowNumeric } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { useMaterialsStore } from '@/stores/materials_store';

const materialsStore = useMaterialsStore();
const materials = computed(() => materialsStore.materials);

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
  costPerFoot: 0,
};

// This ensures that all MaterialCategory values are included in the categoryOrder array
const categoryOrder = [
  'aluminum',
  'steel',
  'stainless',
  'titanium',
  'other',
] as const satisfies readonly MaterialCategory[];
type MissingMaterialCategories = Exclude<MaterialCategory, (typeof categoryOrder)[number]>;
const hasAllMaterialCategories: MissingMaterialCategories extends never ? true : never = true;

const items = computed(() => {
  const groupedMaterials = Object.entries(materialsList).reduce(
    (groups, [name, data]) => {
      const category = data.category;
      groups[category] ??= [];
      groups[category].push({ name, value: name });
      return groups;
    },
    {} as Partial<Record<MaterialCategory, { name: string; value: string }[]>>,
  );

  const groupedMaterialEntries = Object.entries(groupedMaterials) as [
    MaterialCategory,
    { name: string; value: string }[],
  ][];

  return groupedMaterialEntries
    .sort(
      ([categoryA], [categoryB]) =>
        categoryOrder.indexOf(categoryA) - categoryOrder.indexOf(categoryB),
    )
    .flatMap(([category, categoryItems], index, categories) => {
      const headerName = category.charAt(0).toUpperCase() + category.slice(1);
      const sortedCategoryItems = [...categoryItems].sort((a, b) => a.name.localeCompare(b.name));

      return [
        { props: { header: headerName } },
        ...sortedCategoryItems,
        ...(index < categories.length - 1 ? [{ props: { divider: true } }] : []),
      ];
    });
});

const search = ref('');
const selectedMaterial = ref<Material>({ ...defaultMaterial });
const formValid = ref(true);
const typeFilter = ref<'All' | 'Flat' | 'Round'>('All');
const tubingFilter = ref<'All' | 'Tubing' | 'Bar'>('All');
const form = ref();
const pdfReviewDialog = ref(false);
const pdfReviewHasPreview = ref(false);

const pdfReviewDialogMaxWidth = computed(() => (pdfReviewHasPreview.value ? 1400 : 720));

onMounted(() => {
  materialsStore.fetch();
});

watch(pdfReviewDialog, (isOpen) => {
  if (!isOpen) {
    pdfReviewHasPreview.value = false;
  }
});

function onPdfReviewHasPreviewChange(hasPreview: boolean) {
  pdfReviewHasPreview.value = hasPreview;
}

function selectMaterial(material: Material) {
  selectedMaterial.value = { ...material };
}

function addNewMaterial() {
  form.value.reset();
  form.value.resetValidation();
  selectedMaterial.value = { ...defaultMaterial };
}

const isNewMaterial = computed(() => selectedMaterial.value._id === '0');

const materialChanged = computed(() => {
  const material = selectedMaterial.value;
  const original = materials.value.find((m) => m._id === material._id);
  if (!original) return true;

  const supplierChanged = (() => {
    if (typeof material.supplier === 'string' && typeof original.supplier === 'object') {
      return original.supplier._id !== material.supplier;
    }
    return !isEqual(material.supplier, original.supplier);
  })();

  if (supplierChanged) return true;

  const { supplier: _, ...materialWithoutSupplier } = material;
  const { supplier: __, ...originalWithoutSupplier } = original;
  return !isEqual(materialWithoutSupplier, originalWithoutSupplier);
});

const existsInStore = computed<boolean>(() => {
  // Check via material type, type, and dimensions excluding length
  const material = selectedMaterial.value;
  return materials.value.some((m) => {
    if (m._id === material._id) return true;
    if (m.materialType !== material.materialType) return false;
    if (m.type !== material.type) return false;

    if (material.type === 'Flat') {
      const mDims = [m.height, m.width, m.wallThickness].sort((a, b) => (a ?? 0) - (b ?? 0));
      const matDims = [material.height, material.width, material.wallThickness].sort(
        (a, b) => (a ?? 0) - (b ?? 0),
      );
      return mDims.every((dim, i) => dim === matDims[i]);
    }

    if (material.type === 'Round') {
      const mDims = [m.diameter, m.wallThickness].sort((a, b) => (a ?? 0) - (b ?? 0));
      const matDims = [material.diameter, material.wallThickness].sort(
        (a, b) => (a ?? 0) - (b ?? 0),
      );
      return mDims.every((dim, i) => dim === matDims[i]);
    }

    return false;
  });
});

function saveMaterial() {
  normalizeDimensions(selectedMaterial.value);
  form.value.validate();
  if (!formValid.value || (existsInStore.value && isNewMaterial.value)) return;

  if (isNewMaterial.value) {
    materialsStore
      .add(selectedMaterial.value)
      .then(() => {
        addNewMaterial();
        toastSuccess('Material added successfully');
      })
      .catch(() => {
        toastError('Failed to add material');
      });
  } else {
    materialsStore
      .update(selectedMaterial.value)
      .then(() => {
        toastSuccess('Material updated successfully');
      })
      .catch(() => {
        toastError('Failed to update material');
      });
  }
}

const description = computed(() => {
  const material = selectedMaterial.value;
  if (!material.type || !material.materialType) return '';

  const type = material.wallThickness ? 'Tubing' : 'Bar';
  let description = '';

  if (material.type === 'Flat') {
    const materialInfo = material.wallThickness
      ? `${material.height}" x ${material.width}" x ${material.wallThickness}"`
      : `${material.height}" x ${material.width}"`;
    description = `${material.materialType} Flat ${type} - ${materialInfo}`;
  } else if (material.type === 'Round') {
    const diameterInfo = material.wallThickness
      ? `${material.diameter}" ⌀ x ${material.wallThickness}"`
      : `${material.diameter}" ⌀`;
    description = `${material.materialType} Round ${type} - ${diameterInfo}`;
  } else {
    description = `${material.materialType}`;
  }

  selectedMaterial.value.description = description;
  return description;
});

const weight = computed(() => {
  return calculateMaterialWeight(selectedMaterial.value) || 0;
});

const costPerPound = computed(() => {
  if (!weight.value) return 0;
  const material = selectedMaterial.value;
  return material.costPerFoot && material.length
    ? (material.costPerFoot * (material.length / 12)) / weight.value
    : 0;
});

const costPerBar = computed(() => {
  const material = selectedMaterial.value;
  return material.costPerFoot && material.length
    ? material.costPerFoot * (material.length / 12)
    : 0;
});

function onCostInputField(event: Event, field: 'costPerPound' | 'costPerFoot' | 'costPerBar') {
  const value = parseFloat((event.target as HTMLInputElement).value);
  if (Number.isNaN(value)) return;

  if (field === 'costPerFoot') {
    selectedMaterial.value.costPerFoot = value;
  } else if (field === 'costPerPound') {
    const lengthInFeet = (selectedMaterial.value.length || 0) / 12;
    selectedMaterial.value.costPerFoot = lengthInFeet ? (value * weight.value) / lengthInFeet : 0;
  } else if (field === 'costPerBar') {
    const lengthInFeet = (selectedMaterial.value.length || 0) / 12;
    selectedMaterial.value.costPerFoot = lengthInFeet ? value / lengthInFeet : 0;
  }
}

const requiredRule = (v: unknown) => (v !== null && v !== undefined && v !== '') || 'Required';

const numberRequiredRule = (v: unknown) =>
  (v !== null && v !== undefined && !Number.isNaN(v) && v !== '') || 'Must be a valid number';

const numberOptionalRule = (v: unknown) =>
  v === null ||
  v === undefined ||
  v === '' ||
  (!Number.isNaN(v) && Number(v) >= 0) ||
  'Must be a valid number';

function formatMaterialTitle(material: Material): string {
  const type = material.wallThickness ? 'Tubing' : 'Bar';
  return `${material.materialType} ${material.type} ${type}`;
}

function formatMaterialSize(material: Material): string {
  if (material.type === 'Flat') {
    const h = formatNumber(material.height);
    const w = formatNumber(material.width);
    const wall = material.wallThickness ? ` × ${formatNumber(material.wallThickness)} wall` : '';
    return `${h} × ${w}${wall}`;
  }

  if (material.type === 'Round') {
    const d = formatNumber(material.diameter);
    const wall = material.wallThickness ? ` × ${formatNumber(material.wallThickness)} wall` : '';
    return `Ø${d}${wall}`;
  }

  return '';
}

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
</script>

<style scoped>
.materials-list {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}

.material-row {
  min-height: 48px;
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
