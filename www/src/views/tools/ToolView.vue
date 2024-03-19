<template>
  <div v-if="loading" class="d-flex justify-center align-center loading">
    <v-progress-circular indeterminate color="primary" size="150"></v-progress-circular>
  </div>
  <v-container v-else class="container">
    <div class="title text-center">
      <h1>{{ tool.description }}</h1>
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
              <span v-if="tool.position"> - {{ tool.position }}</span>
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
      <v-spacer></v-spacer>
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
          @click="save"
        >
          Save
        </v-btn>
      </div>
    </v-tabs>
    <v-form v-model="valid">
      <v-window v-model="tab" class="tab-window">
        <v-window-item value="general">
          <v-text-field
            v-model="tool.description"
            label="Description"
            :rules="[rules.required]"
          ></v-text-field>
          <div class="d-flex">
            <v-text-field
              v-model="tool.item"
              class="mr-2"
              label="Product Number"
              append-inner-icon="mdi-barcode"
            ></v-text-field>
            <v-text-field
              v-model="tool.barcode"
              class="ml-2"
              label="Barcode"
              append-inner-icon="mdi-barcode"
              :rules="[rules.barcode]"
            ></v-text-field>
          </div>
          <div class="d-flex">
            <v-select
              v-model="tool.vendor"
              label="Brand"
              :items="vendorStore.vendors"
              item-title="name"
              item-value="_id"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" title="">
                  <template v-slot:prepend>
                    <v-avatar rounded="0"
                      ><v-img class="vendor-logo" :src="item.raw.logo"></v-img
                    ></v-avatar>
                  </template>

                  {{ item.raw.name }}
                </v-list-item>
              </template>
            </v-select>
            <v-select
              v-model="tool.coating"
              label="Coating"
              :items="coatings"
              class="ml-2"
            ></v-select>
          </div>
          <v-text-field
            v-model="tool.productLink"
            label="Product Page Link"
            append-inner-icon="mdi-link"
          ></v-text-field>
          <v-text-field
            v-model="tool.techDataLink"
            label="Speed & Feeds Link"
            append-inner-icon="mdi-link"
          ></v-text-field>
          <v-text-field
            v-model="tool.img"
            label="Tool Image URL"
            append-inner-icon="mdi-image-outline"
          ></v-text-field>
        </v-window-item>

        <v-window-item value="stock">
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model.number="tool.stock"
                label="Stock Qty"
                type="number"
                min="0"
                @update:modelValue="checkNumber($event, 'stock')"
              ></v-text-field>
              <v-combobox
                v-model="tool.location"
                :items="toolStore.locations"
                label="Location"
              ></v-combobox>
              <v-text-field
                v-model="tool.position"
                label="Position"
                @update:modelValue="tool.position = tool.position?.toUpperCase()"
              ></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-row class="d-flex flex-row">
                <v-col cols="12">
                  <v-switch
                    v-model="tool.autoReorder"
                    label="Auto Reorder"
                    color="#901394"
                  ></v-switch>
                  <v-checkbox v-model="tool.onOrder" label="On Order" color="#901394"></v-checkbox>
                  <v-sheet v-if="tool.orderedOn" class="ordered-date">
                    Last ordered on: {{ formattedOrderedOn }}
                  </v-sheet>
                </v-col>
              </v-row>
              <v-select
                v-model="tool.supplier"
                label="Supplier"
                :items="supplierStore.suppliers"
                item-title="name"
                item-value="_id"
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template v-slot:prepend>
                      <v-avatar rounded="0"
                        ><v-img class="vendor-logo" :src="item.raw.logo"></v-img
                      ></v-avatar>
                    </template>

                    {{ item.raw.name }}
                  </v-list-item>
                </template>
              </v-select>
              <v-text-field
                v-model.number="tool.cost"
                label="Cost"
                prepend-inner-icon="mdi-currency-usd"
                @update:modelValue="checkNumber($event, 'cost')"
              ></v-text-field>
              <v-text-field
                v-model.number="tool.reorderQty"
                label="Reorder Qty"
                type="number"
                min="0"
                @update:modelValue="checkNumber($event, 'reorderQty')"
              ></v-text-field>
              <v-text-field
                v-model.number="tool.reorderThreshold"
                label="Min Stock Qty"
                type="number"
                min="0"
                @update:modelValue="checkNumber($event, 'reorderThreshold')"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-window-item>

        <v-window-item value="tech">
          <v-text-field
            v-model.number="tool.flutes"
            :label="fluteText"
            type="number"
            min="0"
            @update:modelValue="checkNumber($event, 'flutes')"
          ></v-text-field>
        </v-window-item>
      </v-window>
    </v-form>
  </v-container>
</template>

<script setup lang="ts">
import { isEqual } from 'lodash';
import { DateTime } from 'luxon';
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import axios from '@/plugins/axios';
import router from '@/router';
import { useSupplierStore } from '@/stores/supplier_store';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

const toolStore = useToolStore();
const vendorStore = useVendorStore();
const supplierStore = useSupplierStore();

const tab = ref<'general' | 'stock' | 'tech'>(import.meta.env.PROD ? 'general' : 'stock');
const tool = ref<ToolDoc | ToolDoc_Pop>({
  stock: 0,
  reorderThreshold: 0,
  reorderQty: 0,
  autoReorder: false,
} as ToolDoc_Pop);
const toolOriginal = ref<ToolDoc | ToolDoc_Pop>({} as ToolDoc_Pop);
const valid = ref(false);

const category = ref<ToolCategory>('milling');

onBeforeMount(() => {
  const type = window.localStorage.getItem('type') as ToolCategory | null;
  category.value = type ? type : 'milling';
});

const id = computed(() => {
  return router.currentRoute.value.params.id;
});

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  const routeParams = router.currentRoute.value.params;
  if (routeName === 'viewTool') fetchTool();
  watch(id, () => {
    fetchTool();
  });
  watch(toolStore.rawTools, () => {
    if (routeName !== 'viewTool') return;
    const match = toolStore.rawTools.find((x) => x._id === routeParams.id);
    if (match) {
      tool.value = { ...match };
      toolOriginal.value = { ...match };
    }
  });
});

const coatings = computed(() => {
  if (!tool.value.vendor) return [];
  const id = typeof tool.value.vendor === 'string' ? tool.value.vendor : tool.value.vendor?._id;
  const vendor = vendorStore.vendors.find((x) => x._id === id);
  if (!vendor) return [];
  return vendor.coatings;
});

const loading = ref(false);

function fetchTool(showSpinner: boolean = true) {
  const { id } = router.currentRoute.value.params;
  if (showSpinner) loading.value = true;
  axios
    .get(`/tools/${id}`)
    .then(({ data }: { data: ToolDoc_Pop }) => {
      tool.value = { ...data };
      toolOriginal.value = { ...data };
    })
    .catch(() => {
      alert('Tool not found');
    })
    .finally(() => {
      loading.value = false;
    });
}

const fluteText = computed(() => {
  return category.value === 'milling' ? 'Flutes' : 'Cutting Edges';
});

async function save() {
  const routeName = router.currentRoute.value.name;
  if (routeName === 'createTool') {
    await toolStore.add({ ...(tool.value as ToolDoc), category: category.value });
  } else if (routeName === 'viewTool') {
    await toolStore.update(tool.value as ToolDoc_Pop);
  }
  fetchTool(false);
}

function openLink(link: string | undefined) {
  if (!link) return;
  window.open(link, '_blank');
}

const toolIsAltered = computed<boolean>(() => {
  return !isEqual(tool.value, toolOriginal.value);
});

const formattedOrderedOn = computed(() => {
  if (!tool.value.orderedOn) return '';
  const time = DateTime.fromISO(tool.value.orderedOn);
  return time.toLocaleString();
});

const rules: Rules = {
  required: (val) => !!val || 'Required',
  barcode: (val) => {
    if (!tool.value.item) return true;
    return val !== tool.value.item || 'Not needed if the same as Product Number';
  },
};

function checkNumber(val: string, key: keyof ToolDoc) {
  if (!val) return;
  const num = parseInt(val);
  if (isNaN(num) || num < 0) {
    tool.value[key] = 0 as never;
  }
}
</script>

<style scoped>
.stock {
  font-weight: bolder;
  font-size: 3em;
  line-height: 0.8;
}
.tool-img {
  max-width: 400px;
  max-height: 100px;
}
.title {
  width: 100%;
  border-bottom: 1px solid #d8d8d8;
}
.container {
  height: 200px;
  position: relative;
}
.active {
  background: #901394;
  color: white;
}
.location {
  font-size: 0.8em;
}
.ordered-date {
  margin: auto;
}
.loading {
  height: 100%;
}
</style>
