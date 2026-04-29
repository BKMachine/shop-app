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
              <v-btn
                class="materials-header-action"
                color="primary"
                style="font-size: 0.875rem; line-height: 1.25rem"
                @click="addNewMaterial"
              >
                Add New
              </v-btn>
              <v-btn
                class="ml-2 materials-header-action"
                color="primary"
                style="font-size: 0.875rem; line-height: 1.25rem"
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
                <v-col cols="3">
                  <v-select
                    v-model="selectedMaterial.type"
                    :disabled="!isNewMaterial"
                    hide-details
                    :items="['Flat', 'Round']"
                    label="Type"
                    required
                  />
                </v-col>
                <v-col class="d-flex align-center" cols="3">
                  <v-switch
                    v-model="selectedMaterial.isMetric"
                    class="metric-switch"
                    color="primary"
                    :disabled="!isNewMaterial"
                    hide-details
                    inset
                    label="Size (mm)"
                  />
                </v-col>
              </v-row>

              <v-row v-if="selectedMaterial.type === 'Flat'">
                <v-col cols="4">
                  <v-text-field
                    v-model="heightInput"
                    :disabled="!isNewMaterial"
                    hide-details
                    :label="`Height (${crossSectionUnitLabel})`"
                    min="0"
                    required
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model="widthInput"
                    :disabled="!isNewMaterial"
                    hide-details
                    :label="`Width (${crossSectionUnitLabel})`"
                    min="0"
                    required
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model="wallThicknessInput"
                    clearable
                    :disabled="!isNewMaterial"
                    hide-details
                    :label="`Wall Thickness (${crossSectionUnitLabel})`"
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
                    v-model="diameterInput"
                    :disabled="!isNewMaterial"
                    hide-details
                    :label="`Diameter (${crossSectionUnitLabel})`"
                    min="0"
                    required
                    :rules="[requiredRule, numberRequiredRule]"
                    type="number"
                    @keydown="onlyAllowNumeric($event)"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="wallThicknessInput"
                    :disabled="!isNewMaterial"
                    hide-details
                    :label="`Wall Thickness (${crossSectionUnitLabel})`"
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
                  <CurrencyInput
                    v-model="costPerPoundInput"
                    :disabled="!weight"
                    hide-details
                    label="Cost per Pound (lbs)"
                    :rules="[requiredRule, numberRequiredRule]"
                  />
                </v-col>
                <v-col>
                  <CurrencyInput
                    v-model="costPerFootInput"
                    :disabled="!weight"
                    hide-details
                    label="Cost per Foot (ft)"
                    :rules="[requiredRule, numberRequiredRule]"
                  />
                </v-col>
                <v-col>
                  <CurrencyInput
                    v-model="costPerBarInput"
                    :disabled="!weight"
                    hide-details
                    label="Cost per Bar (ea)"
                    :rules="[requiredRule, numberRequiredRule]"
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
          <LeaveUnsavedChangesDialog
            v-model="leaveDialogVisible"
            :changes="changedMaterialFields"
            :confirm-disabled="!canSaveMaterial"
            :loading="savingMaterial"
            @confirm="saveAndContinue"
            @discard="leaveWithoutSaving"
          />
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { calculateMaterialWeight, normalizeDimensions } from '@repo/utilities/materials';
import isEqual from 'lodash/isEqual';
import { computed, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import CurrencyInput from '@/components/CurrencyInput.vue';
import LeaveUnsavedChangesDialog from '@/components/LeaveUnsavedChangesDialog.vue';
import MaterialPdfReview from '@/components/materials/MaterialPdfReview.vue';
import MaterialSelection from '@/components/materials/MaterialSelection.vue';
import MaterialSketch from '@/components/materials/MaterialSketch.vue';
import MaterialsList from '@/components/materials/MaterialsList.vue';
import SupplierSelect from '@/components/SupplierSelect.vue';
import {
  buildMaterialDescription,
  formatCost,
  formatCrossSectionDimension,
  formatWeight,
  onlyAllowNumeric,
} from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { useMaterialsStore } from '@/stores/materials_store';
import { useSupplierStore } from '@/stores/supplier_store';

const materialsStore = useMaterialsStore();
const supplierStore = useSupplierStore();
const materials = computed(() => materialsStore.materials);

type EditableMaterial = MaterialFields & {
  _id?: string;
  supplier: Supplier | string | null;
  __v?: number;
};

const REQUIRED_MESSAGE = 'Required';
const VALID_NUMBER_MESSAGE = 'Must be a valid number';
const DUPLICATE_MATERIAL_MESSAGE = 'This material already exists.';

const defaultMaterial: EditableMaterial = {
  description: '',
  materialType: '',
  type: 'Flat',
  isMetric: false,
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
const leaveDialogVisible = ref(false);
const savingMaterial = ref(false);
const skipUnsavedChangesGuard = ref(false);
const pendingAction = ref<null | (() => void | Promise<void>)>(null);

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
    isMetric: material.isMetric ?? false,
    supplier: getSupplierId(material.supplier),
  };
}

const comparableFieldLabels = {
  materialType: 'Material Type',
  type: 'Type',
  isMetric: 'Size (mm)',
  height: 'Height',
  width: 'Width',
  diameter: 'Diameter',
  wallThickness: 'Wall Thickness',
  length: 'Length',
  supplier: 'Supplier',
  costPerFoot: 'Cost per Foot',
} satisfies Partial<Record<keyof ReturnType<typeof toComparableMaterial>, string>>;

const comparableSelectedMaterial = computed(() => toComparableMaterial(selectedMaterial.value));
const originalSelectedMaterial = computed<EditableMaterial | Material>(() => {
  return (
    materials.value.find((material) => material._id === selectedMaterial.value._id) ??
    defaultMaterial
  );
});
const comparableOriginalMaterial = computed(() =>
  toComparableMaterial(originalSelectedMaterial.value),
);

const isMaterialChanged = computed<boolean>(() => {
  return !isEqual(comparableSelectedMaterial.value, comparableOriginalMaterial.value);
});

function formatComparableSupplierName(supplier: EditableMaterial['supplier']) {
  if (!supplier) return 'Empty';
  if (typeof supplier !== 'string') return supplier.name;
  return supplierStore.suppliers.find((candidate) => candidate._id === supplier)?.name ?? supplier;
}

function formatChangedMaterialFieldValue(
  key: keyof ReturnType<typeof toComparableMaterial>,
  value: unknown,
  rawValue: unknown,
) {
  if (value == null || value === '') return 'Empty';
  if (key === 'costPerFoot') {
    return `$${formatCost(typeof value === 'number' ? value : Number(value))}`;
  }
  if (key === 'supplier') {
    return formatComparableSupplierName(rawValue as EditableMaterial['supplier']);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function isMissingNumber(value: unknown) {
  return value === null || value === undefined || value === '' || Number.isNaN(value);
}

function getMaterialFieldsBlockingSave() {
  const blocked = new Map<keyof ReturnType<typeof toComparableMaterial>, string>();

  if (!selectedMaterial.value.materialType) blocked.set('materialType', REQUIRED_MESSAGE);
  if (!selectedMaterial.value.type) blocked.set('type', REQUIRED_MESSAGE);
  if (!selectedMaterial.value.supplier) blocked.set('supplier', REQUIRED_MESSAGE);
  if (isMissingNumber(selectedMaterial.value.length)) blocked.set('length', REQUIRED_MESSAGE);

  if (selectedMaterial.value.type === 'Flat') {
    if (isMissingNumber(selectedMaterial.value.height)) blocked.set('height', REQUIRED_MESSAGE);
    if (isMissingNumber(selectedMaterial.value.width)) blocked.set('width', REQUIRED_MESSAGE);
  }

  if (selectedMaterial.value.type === 'Round' && isMissingNumber(selectedMaterial.value.diameter)) {
    blocked.set('diameter', REQUIRED_MESSAGE);
  }

  if (
    selectedMaterial.value.wallThickness !== null &&
    selectedMaterial.value.wallThickness !== undefined &&
    (Number.isNaN(selectedMaterial.value.wallThickness) ||
      Number(selectedMaterial.value.wallThickness) < 0)
  ) {
    blocked.set('wallThickness', VALID_NUMBER_MESSAGE);
  }

  if (existsInStore.value && isNewMaterial.value) {
    blocked.set('materialType', DUPLICATE_MATERIAL_MESSAGE);
    blocked.set('type', DUPLICATE_MATERIAL_MESSAGE);
    blocked.set('isMetric', DUPLICATE_MATERIAL_MESSAGE);
    if (selectedMaterial.value.type === 'Flat') {
      blocked.set('height', DUPLICATE_MATERIAL_MESSAGE);
      blocked.set('width', DUPLICATE_MATERIAL_MESSAGE);
      if (selectedMaterial.value.wallThickness != null) {
        blocked.set('wallThickness', DUPLICATE_MATERIAL_MESSAGE);
      }
    }
    if (selectedMaterial.value.type === 'Round') {
      blocked.set('diameter', DUPLICATE_MATERIAL_MESSAGE);
      if (selectedMaterial.value.wallThickness != null) {
        blocked.set('wallThickness', DUPLICATE_MATERIAL_MESSAGE);
      }
    }
  }

  return blocked;
}

function getChangedMaterialFields() {
  const blockedFields = getMaterialFieldsBlockingSave();

  return Object.entries(comparableFieldLabels)
    .filter(([key]) => {
      const fieldKey = key as keyof ReturnType<typeof toComparableMaterial>;
      return !isEqual(
        comparableSelectedMaterial.value[fieldKey],
        comparableOriginalMaterial.value[fieldKey],
      );
    })
    .map(([key, label]) => {
      const fieldKey = key as keyof ReturnType<typeof toComparableMaterial>;
      return {
        label,
        blockReason: blockedFields.get(fieldKey),
        value: formatChangedMaterialFieldValue(
          fieldKey,
          comparableSelectedMaterial.value[fieldKey],
          selectedMaterial.value[fieldKey],
        ),
      };
    });
}

const changedMaterialFields = computed<
  Array<{ label: string; value: string; blockReason?: string }>
>(() => getChangedMaterialFields());

const existsInStore = computed<boolean>(() => {
  // Check via material type, type, and dimensions excluding length
  const material = selectedMaterial.value;
  return materials.value.some((m) => {
    if (m._id === material._id) return true;
    if (m.materialType !== material.materialType) return false;
    if (m.type !== material.type) return false;
    if (Boolean(m.isMetric) !== Boolean(material.isMetric)) return false;

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
  void guardMaterialNavigation(() => {
    selectMaterialInternal(material);
  });
}

function selectMaterialInternal(material: Material) {
  selectedMaterial.value = { ...material, isMetric: material.isMetric ?? false };
}

function addNewMaterial() {
  void guardMaterialNavigation(() => {
    addNewMaterialInternal();
  });
}

function addNewMaterialInternal() {
  form.value?.resetValidation();
  selectedMaterial.value = { ...defaultMaterial };
}

const canSaveMaterial = computed<boolean>(() => {
  return (
    formValid.value && !(existsInStore.value && isNewMaterial.value) && isMaterialChanged.value
  );
});

async function persistMaterial() {
  normalizeDimensions(selectedMaterial.value);
  form.value.validate();
  if (!canSaveMaterial.value) return false;

  const supplierId = getSupplierId(selectedMaterial.value.supplier);
  if (!supplierId) return false;

  const basePayload: MaterialCreate = {
    description: selectedMaterial.value.description,
    materialType: selectedMaterial.value.materialType,
    type: selectedMaterial.value.type,
    isMetric: selectedMaterial.value.isMetric ?? false,
    height: selectedMaterial.value.height,
    width: selectedMaterial.value.width,
    diameter: selectedMaterial.value.diameter,
    wallThickness: selectedMaterial.value.wallThickness,
    length: selectedMaterial.value.length,
    supplier: supplierId,
    costPerFoot: selectedMaterial.value.costPerFoot,
  };

  savingMaterial.value = true;
  let saved = false;

  if (isNewMaterial.value) {
    await materialsStore
      .add(basePayload)
      .then(() => {
        saved = true;
        addNewMaterialInternal();
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

    await materialsStore
      .update(payload)
      .then(() => {
        saved = true;
        toastSuccess('Material updated successfully');
      })
      .catch(() => {
        toastError('Failed to update material');
      });
  }

  savingMaterial.value = false;
  return saved;
}

async function saveMaterial() {
  await persistMaterial();
}

function shouldBlockNavigation() {
  if (skipUnsavedChangesGuard.value) {
    skipUnsavedChangesGuard.value = false;
    return false;
  }

  return isMaterialChanged.value;
}

async function guardMaterialNavigation(action: () => void | Promise<void>) {
  if (!shouldBlockNavigation()) {
    await action();
    return;
  }

  pendingAction.value = action;
  leaveDialogVisible.value = true;
}

async function saveAndContinue() {
  const action = pendingAction.value;
  if (!action) return;

  const saved = await persistMaterial();
  if (!saved) return;

  leaveDialogVisible.value = false;
  pendingAction.value = null;
  skipUnsavedChangesGuard.value = true;
  await action();
}

async function leaveWithoutSaving() {
  const action = pendingAction.value;
  if (!action) return;

  leaveDialogVisible.value = false;
  pendingAction.value = null;
  skipUnsavedChangesGuard.value = true;
  await action();
}

onBeforeRouteLeave((to) => {
  if (!shouldBlockNavigation()) return true;

  pendingAction.value = async () => {
    await router.push(to.fullPath);
  };
  leaveDialogVisible.value = true;
  return false;
});

const description = computed(() => {
  const description = buildMaterialDescription(selectedMaterial.value);
  selectedMaterial.value.description = description;
  return description;
});

const crossSectionUnitLabel = computed(() => (selectedMaterial.value.isMetric ? 'mm' : 'inches'));

function toCrossSectionDisplayValue(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const formatted = formatCrossSectionDimension(value, selectedMaterial.value.isMetric);
  const parsed = Number.parseFloat(formatted);
  return Number.isFinite(parsed) ? parsed : null;
}

function fromCrossSectionDisplayValue(value: unknown): number | null {
  if (value === '' || value == null) return null;

  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return null;

  return selectedMaterial.value.isMetric ? numeric / 25.4 : numeric;
}

const heightInput = computed<number | null>({
  get: () => toCrossSectionDisplayValue(selectedMaterial.value.height),
  set: (value) => {
    selectedMaterial.value.height = fromCrossSectionDisplayValue(value);
  },
});

const widthInput = computed<number | null>({
  get: () => toCrossSectionDisplayValue(selectedMaterial.value.width),
  set: (value) => {
    selectedMaterial.value.width = fromCrossSectionDisplayValue(value);
  },
});

const diameterInput = computed<number | null>({
  get: () => toCrossSectionDisplayValue(selectedMaterial.value.diameter),
  set: (value) => {
    selectedMaterial.value.diameter = fromCrossSectionDisplayValue(value);
  },
});

const wallThicknessInput = computed<number | null>({
  get: () => toCrossSectionDisplayValue(selectedMaterial.value.wallThickness),
  set: (value) => {
    selectedMaterial.value.wallThickness = fromCrossSectionDisplayValue(value);
  },
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

const costPerPoundInput = computed<number | null>({
  get: () => (weight.value ? costPerPound.value : null),
  set: (value) => {
    const lengthInFeet = (selectedMaterial.value.length || 0) / 12;
    if (value == null || !weight.value || !lengthInFeet) {
      selectedMaterial.value.costPerFoot = 0;
      return;
    }
    selectedMaterial.value.costPerFoot = (value * weight.value) / lengthInFeet;
  },
});

const costPerFootInput = computed<number | null>({
  get: () => selectedMaterial.value.costPerFoot,
  set: (value) => {
    selectedMaterial.value.costPerFoot = value ?? 0;
  },
});

const costPerBarInput = computed<number | null>({
  get: () => {
    if (!weight.value) return null;
    return costPerBar.value;
  },
  set: (value) => {
    const lengthInFeet = (selectedMaterial.value.length || 0) / 12;
    if (value == null || !lengthInFeet) {
      selectedMaterial.value.costPerFoot = 0;
      return;
    }
    selectedMaterial.value.costPerFoot = value / lengthInFeet;
  },
});

const requiredRule = (v: unknown) =>
  (v !== null && v !== undefined && v !== '') || REQUIRED_MESSAGE;

const numberRequiredRule = (v: unknown) =>
  (v !== null && v !== undefined && !Number.isNaN(v) && v !== '') || VALID_NUMBER_MESSAGE;

const numberOptionalRule = (v: unknown) =>
  v === null ||
  v === undefined ||
  v === '' ||
  (!Number.isNaN(v) && Number(v) >= 0) ||
  VALID_NUMBER_MESSAGE;
</script>

<style scoped>
.metric-switch {
  margin-top: 0;
  margin-bottom: 0;
}
</style>
