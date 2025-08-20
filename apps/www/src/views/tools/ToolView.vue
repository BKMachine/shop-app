<template>
  <div v-if="loading" class="d-flex justify-center align-center loading">
    <v-progress-circular indeterminate color="primary" size="150"></v-progress-circular>
  </div>
  <v-container v-else class="container">
    <div class="title text-center">
      <h1>{{ tool.description || 'New Tool' }}</h1>
    </div>
    <div class="d-flex align-center justify-space-between py-4">
      <img class="tool-img" :src="tool.img" alt="" />
      <div class="d-flex">
        <div class="d-flex align-center flex-column mr-4">
          <div class="d-flex flex-column align-center">
            <div class="stock">{{ tool.stock }}</div>
            <div>In Stock</div>
            <div class="location">
              <span v-if="tool.location">
                {{ tool.location }}
              </span>
              <span v-if="tool.position"> | {{ tool.position }}</span>
            </div>
          </div>
        </div>
        <div class="d-flex flex-column align-end justify-center">
          <v-chip :class="{ active: tool.autoReorder }" class="mb-2" density="comfortable">
            Auto Reorder
          </v-chip>
          <v-chip :class="{ active: tool.onOrder }" density="comfortable">On Order</v-chip>
        </div>
      </div>
    </div>
    <v-tabs v-model="tab" class="mb-4" bg-color="#555555" color="yellow">
      <v-tab value="general">General</v-tab>
      <v-tab value="stock">Stock</v-tab>
      <v-tab value="tech">Technical</v-tab>
      <v-spacer />
      <div class="d-flex align-center">
        <v-btn
          v-if="tool.productLink"
          class="mr-2"
          color="yellow"
          prepend-icon="mdi-open-in-new"
          density="comfortable"
          variant="elevated"
          @click="openLink(tool.productLink)"
        >
          Product Page
        </v-btn>
        <v-btn
          v-if="tool.techDataLink"
          class="mr-2"
          color="blue"
          prepend-icon="mdi-speedometer"
          variant="elevated"
          density="comfortable"
          @click="openLink(tool.techDataLink)"
        >
          Tech Data
        </v-btn>
        <v-btn
          color="green"
          variant="elevated"
          class="mr-2"
          density="comfortable"
          prepend-icon="mdi-content-save-outline"
          :disabled="!toolIsAltered || !valid"
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
                label="Product Number"
                :rules="[rules.uniqueItem]"
              >
                <template v-slot:append-inner>
                  <v-icon icon="mdi-barcode"></v-icon>
                  <v-icon icon="mdi-printer-outline" class="ml-2" @click="printItem" />
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="tool.barcode"
                class="ml-2"
                label="Barcode"
                :rules="[rules.barcode, rules.uniqueBarcode]"
              >
                <template v-slot:append-inner>
                  <v-icon icon="mdi-barcode"></v-icon>
                  <v-icon icon="mdi-printer-outline" class="ml-2" @click="printBarcode" />
                </template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="6">
              <v-select
                v-model="tool.vendor"
                class="mr-2"
                label="Brand"
                :items="vendorStore.vendors"
                item-title="name"
                item-value="_id"
                clearable
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template v-slot:prepend>
                      <v-avatar rounded="0">
                        <v-img class="vendor-logo" :src="item.raw.logo"></v-img>
                      </v-avatar>
                    </template>
                    {{ item.raw.name }}
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="tool.coating"
                class="ml-2"
                label="Coating"
                :items="coatings"
                clearable
              />
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="tool.productLink"
              label="Product Page Link"
              append-inner-icon="mdi-link"
            />
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="tool.techDataLink"
              label="Speed & Feeds Link"
              append-inner-icon="mdi-link"
            />
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="tool.img"
              label="Tool Image URL"
              append-inner-icon="mdi-image-outline"
            />
          </v-row>
        </v-window-item>

        <v-window-item value="stock">
          <v-row no-gutters class="mb-4" align="center">
            <v-dialog v-model="manualOrderDialog" max-width="500">
              <template v-slot:activator="{ props: activatorProps }">
                <v-btn
                  v-bind="activatorProps"
                  elevation="2"
                  density="comfortable"
                  variant="tonal"
                  color="#932c95"
                  :disabled="!manualOrderEnabled"
                >
                  <v-icon icon="mdi-cart-arrow-down" />
                </v-btn>
              </template>

              <template v-slot:default>
                <v-card>
                  <v-card-title>Manual Order</v-card-title>
                  <v-card-text>
                    <v-row> How many items would you like to order? </v-row>
                    <v-row class="mt-4">
                      <v-text-field
                        v-model="manualOrderAmount"
                        type="number"
                        label="Amount"
                        placeholder="1"
                        min="1"
                        @keydown="isNumber"
                      ></v-text-field>
                    </v-row>
                  </v-card-text>
                  <v-card-actions>
                    <v-spacer />
                    <v-btn color="green" variant="elevated" @click="addManualOrder">Order</v-btn>
                    <v-btn color="red" variant="elevated" @click="closeManualOrderDialog">
                      Cancel
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </template>
            </v-dialog>
            <v-switch
              v-model="tool.autoReorder"
              label="Auto Reorder"
              class="ml-6"
              color="#932c95"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="tool.onOrder"
              :label="formattedOrderedOn"
              class="ml-3"
              color="#901394"
              density="compact"
              hide-details
              @click="tool.orderedOn = undefined"
            />
          </v-row>
          <v-row no-gutters>
            <v-col cols="6">
              <v-text-field
                v-model.number="tool.stock"
                class="mr-2"
                label="Stock Qty"
                type="number"
                min="0"
                @keydown="isNumber($event)"
              />
              <v-combobox
                v-model="tool.location"
                class="mr-2"
                :items="toolStore.locations"
                label="Location"
              />
              <v-text-field
                v-model="tool.position"
                class="mr-2"
                label="Position"
                @update:modelValue="tool.position = tool.position?.toUpperCase()"
              >
                <template v-slot:append-inner>
                  <v-icon icon="mdi-map-marker-outline" @click="gotoLocation"></v-icon>
                  <v-icon icon="mdi-printer-outline" class="ml-2" @click="printLocation" />
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="tool.supplier"
                class="ml-2"
                label="Supplier"
                :items="supplierStore.suppliers"
                item-title="name"
                item-value="_id"
                clearable
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template v-slot:prepend>
                      <v-avatar rounded="0">
                        <v-img class="vendor-logo" :src="item.raw.logo"></v-img>
                      </v-avatar>
                    </template>
                    {{ item.raw.name }}
                  </v-list-item>
                </template>
              </v-select>
              <CurrencyInput v-model="tool.cost" label="Cost" class="ml-2" />
              <v-row no-gutters>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="tool.reorderQty"
                    class="mx-2"
                    label="Reorder Qty"
                    type="number"
                    min="0"
                    @keydown="isNumber($event)"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="tool.reorderThreshold"
                    class="ml-2"
                    label="Min Stock Qty"
                    type="number"
                    min="0"
                    @keydown="isNumber($event)"
                  />
                </v-col>
              </v-row>
            </v-col>
          </v-row>
          <ToolStockGraph
            v-if="tool._id"
            :id="tool._id"
            :reorderThreshold="tool.reorderThreshold"
            :currentStock="tool.stock"
            :currentCost="tool.cost"
          />
        </v-window-item>

        <v-window-item value="tech">
          <v-row>
            <v-col col="3">
              <v-select v-model="tool.toolType" :items="types" label="Tool Type" clearable />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model.number="tool.flutes"
                :label="fluteText"
                type="number"
                min="0"
                @keydown="isNumber($event)"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-if="showMillingOpts"
                v-model.number="tool.cuttingDia"
                label="Cutting Dia"
                min="0"
                @keydown="isNumber($event)"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-if="showMillingOpts"
                v-model.number="tool.fluteLength"
                label="Flute Length"
                min="0"
                @keydown="isNumber($event)"
              />
            </v-col>
          </v-row>
        </v-window-item>
      </v-window>
    </v-form>
  </v-container>
</template>

<script setup lang="ts">
import isEqual from 'lodash/isEqual';
import { DateTime } from 'luxon';
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CurrencyInput from '@/components/CurrencyInput.vue';
import ToolStockGraph from '@/components/ToolStockGraph.vue';
import axios from '@/plugins/axios';
import printer from '@/plugins/printer';
import toolTypes from '@/plugins/toolTypes';
import { isNumber } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

const toolStore = useToolStore();
const vendorStore = useVendorStore();
const supplierStore = useSupplierStore();

const tool = ref<Tool>({
  stock: 0,
  reorderThreshold: 0,
  reorderQty: 0,
  autoReorder: false,
  onOrder: false,
  flutes: 0,
} as Tool);
const toolOriginal = ref<Tool>({} as Tool);

const category = ref<ToolCategory>('milling');
const tab = ref<'general' | 'stock' | 'tech'>(import.meta.env.PROD ? 'stock' : 'stock');
const id = computed(() => router.currentRoute.value.params.id);
const valid = ref(false);
const loading = ref(false);
const saveFlag = ref(false);

onBeforeMount(() => {
  // Get tool category from local storage to determine which tab to show
  const type = window.localStorage.getItem('type') as ToolCategory | null;
  // Default to milling tab
  category.value = type ? type : 'milling';
});

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  const routeParams = router.currentRoute.value.params;

  // Fetch the tool from the DB if we are viewing a tool and not creating a new tool
  if (routeName === 'viewTool') fetchTool();

  // Fetch the tool from the DB if the route changes
  watch(id, () => fetchTool());

  // Update tool if changed from another user
  watch(toolStore.trigger, () => {
    if (routeName !== 'viewTool') return;
    if (toolStore.trigger.toolID === '') return;
    const match = toolStore.rawTools.find((x) => x._id === routeParams.id);
    if (!match) return;
    if (match._id !== toolStore.trigger.toolID) return;
    // Alert user that the currently viewed tool has updated if not the user that did the update
    // but only if changes are currently being made
    if (!isEqual(tool.value, toolOriginal.value) && saveFlag.value === false) {
      alert('Tool was updated. Local changes will be lost.');
    }
    tool.value = { ...match };
    toolOriginal.value = { ...match };
  });
});

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
    })
    .catch(() => {
      alert('Tool not found.');
    })
    .finally(() => {
      loading.value = false;
    });
}

async function saveTool() {
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

function openLink(link: string | undefined) {
  if (!link) return;
  window.open(link, '_blank');
}

/* FORM VALIDATION */

const toolIsAltered = computed<boolean>(() => !isEqual(tool.value, toolOriginal.value));

const rules: Rules = {
  required: (val) => !!val || 'Required',
  barcode: (val) => {
    if (!tool.value.item) return true;
    return val !== tool.value.item || 'Not needed if the same as Product Number';
  },
  uniqueItem: (val) => {
    if (!tool.value.item) return true;
    return true;
  },
  uniqueBarcode: (val) => {
    if (!tool.value.barcode) return true;
    return true;
  },
};

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
  printer.printItem({ item, description, brand });
}

function printBarcode() {
  const item = tool.value.barcode;
  const description = tool.value.description;
  const vendor = tool.value.vendor;

  if (!item || !description || !vendor) return;
  const brand = typeof vendor === 'string' ? vendor : vendor.name;
  printer.printItem({ item, description, brand });
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
  return toolTypes[tool.value.category || category.value];
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
</style>
