<template>
  <div v-if="loading" class="d-flex justify-center align-center loading">
    <v-progress-circular color="primary" indeterminate size="150" />
  </div>
  <v-container v-else class="container">
    <div class="title text-center">
      <h1>{{ tool.description || 'New Tool' }}</h1>
    </div>
    <div class="d-flex align-center justify-space-between py-4">
      <div class="tool-img-wrapper">
        <img v-if="tool.img" alt="" class="tool-img" :src="tool.img" />
        <MissingImage v-else class="tool-img tool-img-fallback" />
      </div>
      <div class="d-flex">
        <div class="d-flex align-center flex-column mr-4">
          <div class="d-flex flex-column align-center">
            <div class="stock">{{ tool.stock }}</div>
            <div>In Stock</div>
            <div class="location">
              <span v-if="tool.location"> {{ tool.location }}</span>
              <span v-if="tool.position"> | {{ tool.position }}</span>
            </div>
          </div>
        </div>
        <div class="d-flex flex-column align-end justify-center">
          <v-chip class="mb-2" :class="{ active: tool.autoReorder }" density="comfortable">
            Auto Reorder
          </v-chip>
          <v-chip :class="{ active: tool.onOrder }" density="comfortable"> On Order </v-chip>
        </div>
      </div>
    </div>
    <v-tabs v-model="tab" bg-color="#555555" class="mb-4" color="yellow">
      <v-tab value="general"> General </v-tab>
      <v-tab value="stock"> Stock </v-tab>
      <v-tab value="tech"> Technical </v-tab>
      <v-spacer />
      <div class="d-flex align-center">
        <v-btn
          v-if="tool.orderLink"
          class="mr-2"
          color="teal-lighten-2"
          density="comfortable"
          prepend-icon="mdi-cart-outline"
          variant="elevated"
          @click="openLink(tool.orderLink)"
        >
          Order Page
        </v-btn>
        <v-btn
          v-if="tool.productLink"
          class="mr-2"
          color="yellow"
          density="comfortable"
          prepend-icon="mdi-open-in-new"
          variant="elevated"
          @click="openLink(tool.productLink)"
        >
          Product Page
        </v-btn>
        <v-btn
          v-if="tool.techDataLink"
          class="mr-2"
          color="blue"
          density="comfortable"
          prepend-icon="mdi-speedometer"
          variant="elevated"
          @click="openLink(tool.techDataLink)"
        >
          Tech Data
        </v-btn>
        <v-btn
          class="mr-2"
          color="green"
          density="comfortable"
          :disabled="!canSaveTool"
          prepend-icon="mdi-content-save-outline"
          variant="elevated"
          @click="saveTool"
        >
          Save
        </v-btn>
      </div>
    </v-tabs>
    <v-form v-model="valid">
      <v-window v-model="tab" class="tab-window">
        <v-window-item value="general">
          <v-row no-gutters>
            <v-text-field
              v-model="tool.description"
              label="Description"
              :rules="[rules.required]"
            />
          </v-row>
          <v-row no-gutters>
            <v-col cols="6">
              <v-text-field
                v-model="tool.item"
                class="mr-2"
                :error-messages="itemUniqueError ? [itemUniqueError] : []"
                label="Product Number"
                :loading="checkingItemUnique"
                :rules="[rules.required, rules.uniqueItem]"
                @blur="checkItemUnique"
              >
                <template #append-inner>
                  <v-icon icon="mdi-barcode" />
                  <v-icon class="ml-2" icon="mdi-printer-outline" @click="printItem" />
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="tool.barcode"
                class="ml-2"
                :error-messages="barcodeUniqueError ? [barcodeUniqueError] : []"
                label="Barcode"
                :loading="checkingBarcodeUnique"
                :rules="[rules.barcode, rules.uniqueBarcode]"
                @blur="checkBarcodeUnique"
              >
                <template #append-inner>
                  <v-icon icon="mdi-barcode" />
                  <v-icon class="ml-2" icon="mdi-printer-outline" @click="printBarcode" />
                </template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="6">
              <VendorSelect v-model="tool.vendor" class="mr-2" :rules="[rules.required]" />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="tool.coating"
                class="ml-2"
                clearable
                :items="coatings"
                label="Coating"
              />
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="tool.productLink"
              append-inner-icon="mdi-link"
              label="Product Page Link"
            />
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="tool.techDataLink"
              append-inner-icon="mdi-link"
              label="Speed & Feeds Link"
            />
          </v-row>
          <v-row no-gutters>
            <v-col cols="12">
              <div class="d-flex align-center justify-space-between flex-wrap ga-3 py-2">
                <div>
                  <div class="text-subtitle-2">Tool Image</div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ tool.img ? 'Manage the current tool image.' : 'Add a single image for this tool.' }}
                  </div>
                </div>
                <div class="d-flex align-center ga-2">
                  <v-btn
                    color="primary"
                    :disabled="!tool._id"
                    prepend-icon="mdi-image-edit-outline"
                    variant="elevated"
                    @click="imageManagerVisible = true"
                  >
                    {{ tool.img ? 'Edit Image' : 'Add Image' }}
                  </v-btn>
                  <v-btn
                    v-if="tool.img"
                    color="error"
                    :loading="removingImage"
                    prepend-icon="mdi-image-remove-outline"
                    variant="outlined"
                    @click="deleteImageConfirmVisible = true"
                  >
                    Remove Image
                  </v-btn>
                </div>
              </div>
              <div v-if="!tool._id" class="text-body-2 text-medium-emphasis pt-2">
                Save this tool first, then you can attach an image.
              </div>
            </v-col>
          </v-row>
        </v-window-item>

        <v-window-item value="stock">
          <v-row align="center" class="mb-4" no-gutters>
            <v-dialog v-model="manualOrderDialog" max-width="500">
              <template #activator="{ props: activatorProps }">
                <v-btn
                  v-bind="activatorProps"
                  color="#932c95"
                  density="comfortable"
                  :disabled="!manualOrderEnabled"
                  elevation="2"
                  variant="tonal"
                >
                  <v-icon icon="mdi-cart-arrow-down" />
                </v-btn>
              </template>

              <template #default>
                <v-card>
                  <v-card-title>Manual Order</v-card-title>
                  <v-card-text>
                    <v-row>How many items would you like to order? </v-row>
                    <v-row class="mt-4">
                      <v-text-field
                        v-model="manualOrderAmount"
                        label="Amount"
                        min="1"
                        placeholder="1"
                        type="number"
                        @keydown="isNumber"
                      />
                    </v-row>
                  </v-card-text>
                  <v-card-actions>
                    <v-spacer />
                    <v-btn color="green" variant="elevated" @click="addManualOrder"> Order </v-btn>
                    <v-btn color="red" variant="elevated" @click="closeManualOrderDialog">
                      Cancel
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </template>
            </v-dialog>
            <v-switch
              v-model="tool.autoReorder"
              class="ml-6"
              color="#932c95"
              density="compact"
              hide-details
              label="Auto Reorder"
            />
            <v-checkbox
              v-model="tool.onOrder"
              class="ml-3"
              color="#901394"
              density="compact"
              hide-details
              :label="formattedOrderedOn"
              @click="tool.orderedOn = undefined"
            />
          </v-row>

          <v-row no-gutters>
            <v-col cols="3">
              <v-text-field
                v-model.number="tool.stock"
                class="mr-2"
                label="Stock Qty"
                min="0"
                type="number"
                @keydown="isNumber($event)"
              />
            </v-col>
            <v-col cols="3"> <SupplierSelect v-model="tool.supplier" class="mr-2" /> </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="tool.orderLink"
                append-inner-icon="mdi-link"
                class="ml-2"
                label="Order Link"
              />
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="3"> <ToolLocationSelect v-model="tool.location" /> </v-col>
            <v-col cols="3">
              <v-text-field
                v-model="tool.position"
                class="mr-2"
                label="Position"
                @update:model-value="tool.position = tool.position?.toUpperCase()"
              >
                <template #append-inner>
                  <v-icon icon="mdi-map-marker-outline" @click="gotoLocation" />
                  <v-icon class="ml-2" icon="mdi-printer-outline" @click="printLocation" />
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="6">
              <v-row no-gutters>
                <v-col cols="4">
                  <CurrencyInput v-model="tool.cost" class="ml-2" label="Cost" />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="tool.reorderQty"
                    class="mx-2"
                    label="Reorder Qty"
                    min="0"
                    type="number"
                    @keydown="isNumber($event)"
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="tool.reorderThreshold"
                    label="Min Stock Qty"
                    min="0"
                    type="number"
                    @keydown="isNumber($event)"
                  />
                </v-col>
              </v-row>
            </v-col>
          </v-row>
          <v-row no-gutters> <v-col cols="12"> </v-col> </v-row>
          <ToolStockGraph
            v-if="tool._id"
            :id="tool._id"
            :current-cost="tool.cost"
            :current-stock="tool.stock"
            :reorder-threshold="tool.reorderThreshold"
          />
        </v-window-item>

        <v-window-item value="tech">
          <v-row>
            <v-col col="3">
              <v-select v-model="tool.toolType" clearable :items="types" label="Tool Type" />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model.number="tool.flutes"
                :label="fluteText"
                min="0"
                type="number"
                @keydown="isNumber($event)"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-if="showMillingOpts"
                v-model="cuttingDiaInput"
                inputmode="decimal"
                label="Cutting Dia"
                min="0"
                type="text"
                @blur="normalizeDecimalField('cuttingDia')"
                @keydown="isNumber($event)"
                @update:model-value="updateDecimalField('cuttingDia', $event)"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-if="showMillingOpts"
                v-model="fluteLengthInput"
                inputmode="decimal"
                label="Flute Length"
                min="0"
                type="text"
                @blur="normalizeDecimalField('fluteLength')"
                @keydown="isNumber($event)"
                @update:model-value="updateDecimalField('fluteLength', $event)"
              />
            </v-col>
          </v-row>
        </v-window-item>
      </v-window>
    </v-form>
    <ImageManagerDialog
      v-model="imageManagerVisible"
      :entity-id="tool._id"
      entity-type="tool"
      :has-image="Boolean(tool.img)"
      :title="tool.description"
      @image-selected="onToolImageSelected"
    />
    <ConfirmDialog
      v-model="deleteImageConfirmVisible"
      confirm-text="Remove"
      :loading="removingImage"
      message="This will remove the current image from this tool."
      title="Remove Tool Image?"
      @confirm="removeConfirmedToolImage"
    />
  </v-container>
</template>

<script setup lang="ts">
import isEqual from 'lodash/isEqual';
import { DateTime } from 'luxon';
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CurrencyInput from '@/components/CurrencyInput.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import MissingImage from '@/components/MissingImage.vue';
import SupplierSelect from '@/components/SupplierSelect.vue';
import ToolStockGraph from '@/components/ToolStockGraph.vue';
import ToolLocationSelect from '@/components/tools/ToolLocationSelect.vue';
import VendorSelect from '@/components/VendorSelect.vue';
import axios from '@/plugins/axios';
import printer from '@/plugins/printer';
import { isToolCategory } from '@/plugins/toolCategories';
import { isNumber } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { useToolCategoryStore } from '@/stores/tool_category_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

const toolCategoryStore = useToolCategoryStore();
const toolStore = useToolStore();
const vendorStore = useVendorStore();

const defaultToolValues: Partial<Tool> = {
  stock: 0,
  reorderThreshold: 0,
  reorderQty: 0,
  autoReorder: false,
  onOrder: false,
  flutes: 0,
  cost: 0,
};

const tool = ref<Tool>({ ...defaultToolValues } as Tool);
const toolOriginal = ref<Tool>({ ...defaultToolValues } as Tool);

const category = ref<ToolCategory>('milling');
const tab = ref<'general' | 'stock' | 'tech'>(import.meta.env.PROD ? 'general' : 'stock');
const id = computed(() => router.currentRoute.value.params.id);
const valid = ref(false);
const loading = ref(false);
const saveFlag = ref(false);
const imageManagerVisible = ref(false);
const deleteImageConfirmVisible = ref(false);
const removingImage = ref(false);
const itemUniqueError = ref('');
const barcodeUniqueError = ref('');
const checkingItemUnique = ref(false);
const checkingBarcodeUnique = ref(false);
const cuttingDiaInput = ref('');
const fluteLengthInput = ref('');

type DecimalFieldKey = 'cuttingDia' | 'fluteLength';

function setTabFromQuery() {
  const routeTab = router.currentRoute.value.query.tab;
  const validTabs = ['general', 'stock', 'tech'] as const;

  if (typeof routeTab === 'string' && validTabs.includes(routeTab as (typeof validTabs)[number])) {
    tab.value = routeTab as typeof tab.value;
  }
}

onBeforeMount(() => {
  // Get tool category from local storage to determine which tab to show
  const type = window.localStorage.getItem('type');
  // Default to milling tab
  category.value = isToolCategory(type) ? type : 'milling';
});

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  const routeParams = router.currentRoute.value.params;

  setTabFromQuery();

  if (routeName === 'createTool') {
    tool.value = { ...defaultToolValues, category: category.value } as Tool;
    toolOriginal.value = { ...tool.value };
    syncDecimalInputs();
  }

  // Fetch the tool from the DB if we are viewing a tool and not creating a new tool
  if (routeName === 'viewTool') fetchTool();

  // Fetch the tool from the DB if the route changes
  watch(id, () => {
    setTabFromQuery();
    fetchTool();
  });

  // Update tool if changed from another user
  watch(toolStore.toolUpdateSignal, () => {
    if (routeName !== 'viewTool') return;
    if (toolStore.toolUpdateSignal.id === '') return;
    if (routeParams.id !== toolStore.toolUpdateSignal.id) return;
    // Alert user that the currently viewed tool has updated if not the user that did the update
    // but only if changes are currently being made
    if (!isEqual(tool.value, toolOriginal.value) && saveFlag.value === false) {
      alert('Tool was updated. Local changes will be lost.');
    }
    fetchTool(false);
  });
});

watch(tab, (newTab) => {
  const query = router.currentRoute.value.query;
  if (query.tab === newTab) return;

  router.replace({
    query: {
      ...query,
      tab: newTab,
    },
  });
});

watch(
  () => tool.value.item,
  () => {
    itemUniqueError.value = '';
  },
);

watch(
  () => tool.value.barcode,
  () => {
    barcodeUniqueError.value = '';
  },
);

onBeforeUnmount(() => {
  // Store the tool we were viewing to slightly highlight the row in the tool list
  toolStore.setLastId(tool.value._id);
});

function fetchTool(showSpinner: boolean = true) {
  const { id } = router.currentRoute.value.params;
  if (showSpinner) loading.value = true;
  axios
    .get(`/tools/${id}`)
    .then(({ data }: { data: Tool }) => {
      tool.value = { ...data };
      toolOriginal.value = { ...data };
      syncDecimalInputs();
    })
    .catch(() => {
      alert('Tool not found.');
    })
    .finally(() => {
      loading.value = false;
    });
}

async function saveTool() {
  if (!canSaveTool.value) return;

  const routeName = router.currentRoute.value.name;

  saveFlag.value = true;
  if (routeName === 'createTool') {
    await toolStore
      .add({ ...tool.value, category: category.value })
      .then(() => {
        toastSuccess('Tool added successfully');
      })
      .catch(() => {
        toastError('Unable to add tool');
      });
  } else if (routeName === 'viewTool') {
    await toolStore
      .update(tool.value)
      .then(() => {
        toastSuccess('Tool updated successfully');
      })
      .catch(() => {
        toastError('Unable to update tool');
      });
  }
  saveFlag.value = false;
  router.back();
}

function onToolImageSelected(payload: { imageId: string; url: string; isMain?: boolean }) {
  tool.value.img = payload.url;
  if (tool.value._id) {
    toolStore.updateToolImage(tool.value._id, payload.url);
  }
}

function removeConfirmedToolImage() {
  removeToolImage();
}

async function removeToolImage() {
  if (!tool.value._id) return;

  removingImage.value = true;
  try {
    await axios.delete(`/images/entities/tool/${tool.value._id}/image`);
    tool.value.img = '';
    toolStore.updateToolImage(tool.value._id, '');
    deleteImageConfirmVisible.value = false;
    toastSuccess('Tool image removed');
  } catch {
    toastError('Unable to remove tool image');
  } finally {
    removingImage.value = false;
  }
}

function openLink(link: string | undefined) {
  if (!link) return;
  window.open(link, '_blank');
}

/* FORM VALIDATION */

function normalizeComparableString(value: string | undefined | null) {
  if (value == null) return undefined;
  return value.trim() === '' ? undefined : value;
}

function normalizeComparableNumber(value: number | undefined | null) {
  if (value == null || Number.isNaN(value)) return undefined;
  return value;
}

function normalizeComparableEntity(value: { _id: string } | string | undefined | null) {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value._id;
}

function toComparableTool(toolValue: Tool) {
  return {
    ...toolValue,
    description: normalizeComparableString(toolValue.description),
    item: normalizeComparableString(toolValue.item),
    barcode: normalizeComparableString(toolValue.barcode),
    coating: normalizeComparableString(toolValue.coating),
    toolType: normalizeComparableString(toolValue.toolType),
    productLink: normalizeComparableString(toolValue.productLink),
    techDataLink: normalizeComparableString(toolValue.techDataLink),
    orderLink: normalizeComparableString(toolValue.orderLink),
    orderedOn: normalizeComparableString(toolValue.orderedOn),
    location: normalizeComparableString(toolValue.location),
    position: normalizeComparableString(toolValue.position),
    flutes: normalizeComparableNumber(toolValue.flutes),
    cuttingDia: normalizeComparableNumber(toolValue.cuttingDia),
    fluteLength: normalizeComparableNumber(toolValue.fluteLength),
    vendor: normalizeComparableEntity(toolValue.vendor),
    supplier: normalizeComparableEntity(toolValue.supplier),
  };
}

const toolIsAltered = computed<boolean>(() => {
  return !isEqual(toComparableTool(tool.value), toComparableTool(toolOriginal.value));
});
const hasRequiredToolFields = computed<boolean>(() => {
  return Boolean(tool.value.description?.trim() && tool.value.item?.trim() && tool.value.vendor);
});
const hasUniqueFieldErrors = computed<boolean>(() => {
  return Boolean(itemUniqueError.value || barcodeUniqueError.value);
});
const isCheckingUniqueFields = computed<boolean>(() => {
  return checkingItemUnique.value || checkingBarcodeUnique.value;
});
const canSaveTool = computed<boolean>(() => {
  return (
    toolIsAltered.value &&
    valid.value &&
    hasRequiredToolFields.value &&
    !hasUniqueFieldErrors.value &&
    !isCheckingUniqueFields.value
  );
});

const rules = {
  required: (val) => {
    if (typeof val === 'string') {
      return val.trim().length > 0 || 'Required';
    }
    return !!val || 'Required';
  },
  barcode: (val) => {
    if (!tool.value.item) return true;
    return val !== tool.value.item || 'Not needed if the same as Product Number';
  },
  uniqueItem: (val) => {
    if (!tool.value.item) return true;
    return !itemUniqueError.value || itemUniqueError.value;
  },
  uniqueBarcode: (val) => {
    if (!tool.value.barcode) return true;
    return !barcodeUniqueError.value || barcodeUniqueError.value;
  },
} satisfies Rules;

function normalizeScanCode(value: string | undefined) {
  return value?.trim() || '';
}

function formatDecimalInput(value: number | undefined) {
  return value === undefined ? '' : String(value);
}

function getDecimalInputRef(field: DecimalFieldKey) {
  return field === 'cuttingDia' ? cuttingDiaInput : fluteLengthInput;
}

function syncDecimalInputs() {
  cuttingDiaInput.value = formatDecimalInput(tool.value.cuttingDia);
  fluteLengthInput.value = formatDecimalInput(tool.value.fluteLength);
}

function updateDecimalField(field: DecimalFieldKey, value: string | null) {
  const nextValue = value ?? '';
  const inputRef = getDecimalInputRef(field);
  inputRef.value = nextValue;

  if (nextValue.trim() === '') {
    tool.value[field] = undefined;
    return;
  }

  const parsedValue = Number(nextValue);
  if (Number.isNaN(parsedValue)) {
    return;
  }

  tool.value[field] = parsedValue;
}

function normalizeDecimalField(field: DecimalFieldKey) {
  const inputRef = getDecimalInputRef(field);
  const normalizedValue = inputRef.value.trim();

  if (!normalizedValue) {
    inputRef.value = '';
    tool.value[field] = undefined;
    return;
  }

  const parsedValue = Number(normalizedValue);
  if (Number.isNaN(parsedValue)) {
    inputRef.value = formatDecimalInput(tool.value[field]);
    return;
  }

  tool.value[field] = parsedValue;
  inputRef.value = String(parsedValue);
}

function matchesCurrentTool(candidate: Tool) {
  return Boolean(tool.value._id && candidate._id === tool.value._id);
}

async function validateUniqueScanCode(
  scanCode: string | undefined,
  setChecking: { value: boolean },
  setError: { value: string },
  duplicateMessage: string,
) {
  const normalizedScanCode = normalizeScanCode(scanCode);
  setError.value = '';

  if (!normalizedScanCode) return;

  setChecking.value = true;
  try {
    const { data } = await axios.get<Tool>(`/tools/info/${encodeURIComponent(normalizedScanCode)}`);
    if (!matchesCurrentTool(data)) {
      setError.value = duplicateMessage;
    }
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
    if (status !== 404) {
      setError.value = 'Unable to verify uniqueness';
    }
  } finally {
    setChecking.value = false;
  }
}

async function checkItemUnique() {
  await validateUniqueScanCode(
    tool.value.item,
    checkingItemUnique,
    itemUniqueError,
    'Product Number already exists',
  );
}

async function checkBarcodeUnique() {
  const normalizedBarcode = normalizeScanCode(tool.value.barcode);
  if (!normalizedBarcode) {
    barcodeUniqueError.value = '';
    return;
  }

  if (normalizedBarcode === normalizeScanCode(tool.value.item)) {
    barcodeUniqueError.value = '';
    return;
  }

  await validateUniqueScanCode(
    normalizedBarcode,
    checkingBarcodeUnique,
    barcodeUniqueError,
    'Barcode already exists',
  );
}
/* GENERAL TAB LOGIC */

const coatings = computed(() => {
  if (!tool.value.vendor) return [];
  const id = typeof tool.value.vendor === 'string' ? tool.value.vendor : tool.value.vendor?._id;
  const vendor = vendorStore.vendors.find((x) => x._id === id);
  if (!vendor) return [];
  return vendor.coatings;
});

function printItem() {
  const item = tool.value.item;
  const description = tool.value.description;
  const vendor = tool.value.vendor;

  if (!item || !description || !vendor) return;
  const brand = typeof vendor === 'string' ? vendor : vendor.name;
  printer.printAddress({ item, description, brand });
}

function printBarcode() {
  const item = tool.value.barcode;
  const description = tool.value.description;
  const vendor = tool.value.vendor;

  if (!item || !description || !vendor) return;
  const brand = typeof vendor === 'string' ? vendor : vendor.name;
  printer.printAddress({ item, description, brand });
}

/* STOCK TAB LOGIC */

const formattedOrderedOn = computed(() => {
  if (!tool.value.orderedOn || !tool.value.onOrder) return 'On Order';
  const time = DateTime.fromISO(tool.value.orderedOn);
  return `On Order: ${time.toLocaleString()}`;
});

function gotoLocation() {
  if (!tool.value.location || !tool.value.position) return;
  router.push({ name: 'locations', query: { loc: tool.value.location, pos: tool.value.position } });
}

function printLocation() {
  const loc = tool.value.location;
  const pos = tool.value.position;
  if (!loc || !pos) return;
  printer.printLocation({ loc, pos });
}

const manualOrderDialog = ref(false);
const manualOrderAmount = ref(1);
const manualOrderEnabled = computed(() => {
  return tool.value.item && tool.value.vendor && tool.value.supplier;
});

async function addManualOrder() {
  // await saveTool(true);
  toastSuccess('Manual order placed');
  closeManualOrderDialog();
}

function closeManualOrderDialog() {
  manualOrderDialog.value = false;
  setTimeout(() => {
    manualOrderAmount.value = 1;
  }, 1000);
}

/* TECHNICAL TAB LOGIC */

const fluteText = computed(() => {
  return category.value === 'milling' ? 'Flutes' : 'Cutting Edges';
});

const types = computed<readonly string[]>(() => {
  return toolCategoryStore.getTypes(tool.value.category || category.value);
});

const showMillingOpts = computed<boolean>(() => {
  if (tool.value.category) {
    return tool.value.category === 'milling';
  }
  return category.value === 'milling';
});
</script>

<style scoped>
.container {
  height: 200px;
  position: relative;
}
.title {
  width: 100%;
  border-bottom: 1px solid #d8d8d8;
}
.tool-img {
  max-width: 400px;
  max-height: 100px;
  object-fit: contain;
}
.tool-img-wrapper {
  position: relative;
  display: inline-flex;
  align-items: flex-start;
}
.tool-img-fallback {
  width: 100px;
  max-width: 100px;
  min-height: 100px;
  margin: 4px 0;
  border-radius: 8px;
}
.stock {
  font-weight: bolder;
  font-size: 3em;
  line-height: 0.8;
}
.location {
  font-size: 0.8em;
}
.loading {
  height: 100%;
}
.active {
  background: #932c95;
  color: white;
}
.v-window-item {
  padding: 0 1rem 1rem 1rem;
}
</style>
