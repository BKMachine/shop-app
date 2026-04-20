<template>
  <v-container>
    <v-row>
      <!-- Left Column: Material List -->
      <v-col cols="4">
        <MaterialsList
          :materials="materials"
          :selected-material-id="selectedMaterialId"
          @select="selectMaterial"
        />
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
                  <MaterialSelection
                    v-model="selectedMaterial.materialType"
                    :disabled="!isNewMaterial"
                  />
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
                    hide-details
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
                    hide-details
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
                    hide-details
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
                    hide-details
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
                :disabled="!formValid || (existsInStore && isNewMaterial) || !isMaterialChanged"
                variant="elevated"
                @click="saveMaterial"
              >
                Save
              </v-btn>
            </v-card-actions>
          </v-card>

          <v-dialog
            v-model="pdfReviewDialog"
            :max-width="pdfReviewDialogMaxWidth"
            scrollable
            @update:model-value="!$event && (pdfReviewHasPreview = false)"
          >
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
                <MaterialPdfReview @has-preview-change="pdfReviewHasPreview = $event" />
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { calculateMaterialWeight, normalizeDimensions } from '@repo/utilities/materials';
import isEqual from 'lodash/isEqual';
import { computed, onMounted, ref } from 'vue';
import MaterialPdfReview from '@/components/materials/MaterialPdfReview.vue';
import MaterialSelection from '@/components/materials/MaterialSelection.vue';
import MaterialSketch from '@/components/materials/MaterialSketch.vue';
import MaterialsList from '@/components/materials/MaterialsList.vue';
import SupplierSelect from '@/components/SupplierSelect.vue';
import {
  buildMaterialDescription,
  formatCost,
  formatWeight,
  onlyAllowNumeric,
} from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { useMaterialsStore } from '@/stores/materials_store';

const materialsStore = useMaterialsStore();
const materials = computed(() => materialsStore.materials);

type EditableMaterial = MaterialFields & {
  _id?: string;
  supplier: Supplier | string | null;
  __v?: number;
};

const defaultMaterial: EditableMaterial = {
  description: '',
  materialType: '',
  type: 'Flat',
  height: null,
  width: null,
  diameter: null,
  wallThickness: null,
  length: 144,
  supplier: null,
  costPerFoot: 0,
};

const selectedMaterial = ref<EditableMaterial>({ ...defaultMaterial });
const formValid = ref(true);
const form = ref();
const pdfReviewDialog = ref(false);
const pdfReviewHasPreview = ref(false);
const pdfReviewDialogMaxWidth = computed(() => (pdfReviewHasPreview.value ? 1400 : 720));

onMounted(() => {
  materialsStore.fetch();
});

const selectedMaterialId = computed(() => selectedMaterial.value._id ?? '');
const isNewMaterial = computed<boolean>(() => !selectedMaterial.value._id);

function getSupplierId(supplier: EditableMaterial['supplier']): string | null {
  if (!supplier) return null;
  return typeof supplier === 'string' ? supplier : supplier._id;
}

function toComparableMaterial(material: EditableMaterial | Material) {
  return {
    ...material,
    supplier: getSupplierId(material.supplier),
  };
}

const isMaterialChanged = computed<boolean>(() => {
  const material = selectedMaterial.value;
  const original = materials.value.find((m) => m._id === material._id);
  if (!original) return true;
  return !isEqual(toComparableMaterial(material), toComparableMaterial(original));
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

function selectMaterial(material: Material) {
  selectedMaterial.value = { ...material };
}

function addNewMaterial() {
  form.value?.resetValidation();
  selectedMaterial.value = { ...defaultMaterial };
}

function saveMaterial() {
  normalizeDimensions(selectedMaterial.value);
  form.value.validate();
  if (!formValid.value || (existsInStore.value && isNewMaterial.value)) return;

  const supplierId = getSupplierId(selectedMaterial.value.supplier);
  if (!supplierId) return;

  const basePayload: MaterialCreate = {
    description: selectedMaterial.value.description,
    materialType: selectedMaterial.value.materialType,
    type: selectedMaterial.value.type,
    height: selectedMaterial.value.height,
    width: selectedMaterial.value.width,
    diameter: selectedMaterial.value.diameter,
    wallThickness: selectedMaterial.value.wallThickness,
    length: selectedMaterial.value.length,
    supplier: supplierId,
    costPerFoot: selectedMaterial.value.costPerFoot,
  };

  if (isNewMaterial.value) {
    materialsStore
      .add(basePayload)
      .then(() => {
        addNewMaterial();
        toastSuccess('Material added successfully');
      })
      .catch(() => {
        toastError('Failed to add material');
      });
  } else {
    const materialId = selectedMaterial.value._id;
    if (!materialId) return;

    const payload: MaterialUpdate = {
      ...basePayload,
      _id: materialId,
      __v: selectedMaterial.value.__v,
    };

    materialsStore
      .update(payload)
      .then(() => {
        toastSuccess('Material updated successfully');
      })
      .catch(() => {
        toastError('Failed to update material');
      });
  }
}

const description = computed(() => {
  const description = buildMaterialDescription(selectedMaterial.value);
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
</script>

<style scoped>
</style>
