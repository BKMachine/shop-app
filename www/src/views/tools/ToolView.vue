<template>
  <v-container class="container">
    <div class="title text-center">
      <h1>{{ tool.description }}</h1>
    </div>
    <div class="d-flex align-center justify-space-between py-4">
      <img class="tool-img" :src="tool.img" alt="" />
      <div class="d-flex">
        <div class="d-flex align-center flex-column mr-6">
          <div class="stock">
            {{ tool.stock }}
          </div>
          <div>In Stock</div>
        </div>
        <div class="d-flex flex-column align-end justify-center">
          <v-chip :class="{ active: tool.autoReorder }" class="mb-2">Auto Reorder</v-chip>
          <v-chip :class="{ active: tool.onOrder }">On Order</v-chip>
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
          :disabled="!toolIsAltered"
          @click="save"
        >
          Save
        </v-btn>
      </div>
    </v-tabs>
    <v-form>
      <v-window v-model="tab" class="tab-window">
        <v-window-item value="general">
          <v-text-field v-model="tool.description" label="Description"></v-text-field>
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
          <v-switch v-model="tool.autoReorder" label="Auto Reorder" color="green"></v-switch>
          <v-checkbox v-model="tool.onOrder" label="On Order" color="green"></v-checkbox>
          <v-text-field v-model.number="tool.stock" label="Stock Qty"></v-text-field>
          <v-text-field
            v-model.number="tool.cost"
            label="Cost"
            prepend-inner-icon="mdi-currency-usd"
          ></v-text-field>
          <v-text-field v-model.number="tool.reorderQty" label="Reorder Qty"></v-text-field>
          <v-text-field v-model.number="tool.reorderThreshold" label="Min Stock Qty"></v-text-field>
        </v-window-item>

        <v-window-item value="tech">
          <v-text-field v-model.number="tool.flutes" :label="fluteText"></v-text-field>
        </v-window-item>
      </v-window>
    </v-form>
  </v-container>
</template>

<script setup lang="ts">
import { isEqual } from 'lodash';
import { computed, onBeforeMount, onMounted, ref } from 'vue';
import axios from '@/plugins/axios';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';
import { useVendorStore } from '@/stores/vendor_store';

const toolStore = useToolStore();
const vendorStore = useVendorStore();

const tab = ref('general');
const tool = ref<ToolDoc | ToolDoc_Vendor>({
  stock: 0,
  reorderThreshold: 0,
  reorderQty: 0,
  autoReorder: false,
} as ToolDoc_Vendor);
const toolOriginal = ref<ToolDoc | ToolDoc_Vendor>({} as ToolDoc_Vendor);

const category = ref<ToolCategory>('milling');

onBeforeMount(() => {
  const type = window.localStorage.getItem('type') as ToolCategory | null;
  category.value = type ? type : 'milling';
});

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  if (routeName === 'viewTool') fetchTool();
});

const coatings = computed(() => {
  if (!tool.value.vendor) return [];
  const vendor = vendorStore.vendors.find((x) => x._id === tool.value.vendor);
  if (!vendor) return [];
  return vendor.coatings;
});

function fetchTool() {
  const { id } = router.currentRoute.value.params;
  const match = toolStore.tools.find((x) => x._id === id);
  if (match) {
    tool.value = { ...match };
    toolOriginal.value = { ...match };
  } else {
    axios
      .get(`/tools/${id}`)
      .then(({ data }: { data: ToolDoc_Vendor }) => {
        tool.value = { ...data };
        toolOriginal.value = { ...data };
      })
      .catch(() => {
        alert('Tool not found');
      });
  }
}

const fluteText = computed(() => {
  return category.value === 'milling' ? 'Flutes' : 'Cutting Edges';
});

async function save() {
  const routeName = router.currentRoute.value.name;
  if (routeName === 'createTool') {
    await toolStore.add({ ...(tool.value as ToolDoc), category: category.value });
  } else if (routeName === 'viewTool') {
    await toolStore.update(tool.value as ToolDoc_Vendor);
  }
  await router.push({ name: 'tools' });
}

function openLink(link: string | undefined) {
  if (!link) return;
  window.open(link, '_blank');
}

const toolIsAltered = computed<boolean>(() => {
  return !isEqual(tool.value, toolOriginal.value);
});
</script>

<style scoped>
.stock-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex-direction: column;
}
.stock {
  font-weight: bolder;
  font-size: 3em;
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
</style>
