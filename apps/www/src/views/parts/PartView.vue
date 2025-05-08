<template>
  <div v-if="loading" class="d-flex justify-center align-center loading">
    <v-progress-circular indeterminate color="primary" size="150"></v-progress-circular>
  </div>
  <v-container v-else class="container">
    <div class="title text-center">
      <h1>{{ part.part }}</h1>
      <h3>{{ part.description }}</h3>
    </div>
    <div class="d-flex align-center justify-space-between py-4">
      <img class="part-img" :src="part.img" alt="" />
      <div class="d-flex">
        <div class="d-flex align-center flex-column mr-4">
          <div class="d-flex flex-column align-center">
            <div class="stock">{{ part.stock }}</div>
            <div>In Stock</div>
            <div class="location">
              <span v-if="part.location">
                {{ part.location }}
              </span>
              <span v-if="part.position"> | {{ part.position }}</span>
            </div>
          </div>
        </div>
        <!--        <div class="d-flex flex-column align-end justify-center">
          <v-chip :class="{ active: part.autoReorder }" class="mb-2" density="comfortable">
            Auto Reorder
          </v-chip>
          <v-chip :class="{ active: part.onOrder }" density="comfortable">On Order</v-chip>
        </div>-->
      </div>
    </div>
    <v-tabs v-model="tab" class="mb-4" bg-color="#555555" color="secondary">
      <v-tab value="general">General</v-tab>
      <v-tab value="material">Material</v-tab>
      <v-tab value="stock">Stock</v-tab>
      <v-tab value="docs">Documents</v-tab>
      <v-tab value="notes">Notes</v-tab>
      <v-spacer />
      <div class="d-flex align-center">
        <v-btn
          v-if="showAdd"
          color="blue"
          variant="elevated"
          density="comfortable"
          prepend-icon="mdi-plus"
          class="mr-2"
          @click="addNew"
        >
          Add
        </v-btn>
        <v-btn
          color="green"
          variant="elevated"
          class="mr-2"
          density="comfortable"
          prepend-icon="mdi-content-save-outline"
          :disabled="!partIsAltered || !valid"
          @click="savePart"
        >
          Save
        </v-btn>
      </div>
    </v-tabs>
    <v-form v-model="valid">
      <v-window v-model="tab" class="tab-window">
        <v-window-item value="general">
          <v-row no-gutters>
            <v-col cols="5">
              <v-text-field
                v-model="part.part"
                class="mr-2"
                label="Part Number"
                :rules="[rules.required]"
              >
                <template v-slot:append-inner>
                  <!--                  <v-icon icon="mdi-barcode"></v-icon>
                  <v-icon icon="mdi-printer-outline" class="ml-2" @click="printItem" />-->
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="1">
              <v-text-field v-model="part.revision" label="Rev"> </v-text-field>
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="part.customer"
                class="ml-2"
                label="Customer"
                :items="customerStore.customers"
                item-title="name"
                item-value="_id"
                clearable
                :rules="[rules.required]"
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template v-slot:prepend>
                      <v-avatar rounded="0">
                        <v-img class="customer-logo" :src="item.raw.logo"></v-img>
                      </v-avatar>
                    </template>
                    {{ item.raw.name }}
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="12">
              <v-text-field
                v-model="part.description"
                label="Description"
                :rules="[rules.required]"
              />
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="part.img"
              label="Part Image URL"
              append-inner-icon="mdi-image-outline"
            />
          </v-row>
        </v-window-item>

        <v-window-item value="material">
          <v-row no-gutters>
            <v-col cols="6">
              <v-select
                v-model="part.material"
                item-title="description"
                item-value="_id"
                :items="materialsStore.materials"
                label="Material"
                @update:modelValue="assignMaterial"
              >
              </v-select>
            </v-col>
            <v-col cols="2">
              <v-text-field
                v-model="part.materialLength"
                label="Material Length"
                class="ml-2"
                type="number"
                min="0"
              >
              </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <div class="d-flex align-center ml-4">
              {{ part.material ? part.material.length : 0 }} / {{ part.materialLength }} =
              <span class="font-weight-bold mx-1">
                {{ partsPerBar }}
              </span>
              parts per bar
            </div>
          </v-row>
        </v-window-item>

        <v-window-item value="stock">
          <v-row no-gutters>
            <v-col cols="4">
              <v-text-field
                v-model.number="part.stock"
                class="mr-2"
                label="Stock Qty"
                type="number"
                min="0"
                @keydown="isNumber($event)"
              />
            </v-col>
            <v-col cols="4">
              <v-combobox
                v-model="part.location"
                class="mx-2"
                :items="partStore.locations"
                label="Location"
              />
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model="part.position"
                class="ml-2"
                label="Position"
                @update:modelValue="part.position = part.position?.toUpperCase()"
              >
                <template v-slot:append-inner>
                  <!--                  <v-icon icon="mdi-map-marker-outline" @click="gotoLocation"></v-icon>
                  <v-icon icon="mdi-printer-outline" class="ml-2" @click="printLocation" />-->
                </template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <PartStockGraph v-if="part._id" :id="part._id" :currentStock="part.stock" />
          </v-row>
        </v-window-item>

        <v-window-item value="docs"> DOCS </v-window-item>

        <v-window-item value="notes"> NOTES </v-window-item>
      </v-window>
    </v-form>
  </v-container>
</template>

<script setup lang="ts">
import isEqual from 'lodash/isEqual';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PartStockGraph from '@/components/PartStockGraph.vue';
import axios from '@/plugins/axios';
import printer from '@/plugins/printer';
import { isNumber } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { useCustomerStore } from '@/stores/customer_store';
import { useMaterialsStore } from '@/stores/materials_store';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();
const customerStore = useCustomerStore();
const materialsStore = useMaterialsStore();

const showAdd = computed(() => {
  const tabs = ['docs', 'notes'];
  return tabs.includes(tab.value);
});

const part = ref<PartDoc>({
  stock: 0,
} as PartDoc);
const partOriginal = ref<PartDoc>({} as PartDoc);

const tab = ref<'general' | 'material' | 'stock' | 'docs' | 'notes'>(
  import.meta.env.PROD ? 'general' : 'general',
);
const id = computed(() => router.currentRoute.value.params.id);
const valid = ref(false);
const loading = ref(false);
const saveFlag = ref(false);

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  const routeParams = router.currentRoute.value.params;

  // Fetch the part from the DB if we are viewing a part and not creating a new part
  if (routeName === 'viewPart') fetchPart();

  // Fetch the tool from the DB if the route changes
  watch(id, () => fetchPart());

  // Update tool if changed from another user
  /*watch(toolStore.trigger, () => { // TODO
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
  });*/
});

onBeforeUnmount(() => {
  // Store the part we were viewing to slightly highlight the row in the part list
  partStore.setLastId(part.value._id);
});

function fetchPart(showSpinner: boolean = true) {
  const { id } = router.currentRoute.value.params;
  if (showSpinner) loading.value = true;
  axios
    .get(`/parts/${id}`)
    .then(({ data }: { data: PartDoc }) => {
      part.value = { ...data };
      partOriginal.value = { ...data };
    })
    .catch(() => {
      alert('Part not found.');
    })
    .finally(() => {
      loading.value = false;
    });
}

async function savePart() {
  const routeName = router.currentRoute.value.name;
  saveFlag.value = true;
  if (routeName === 'createPart') {
    await partStore
      .add(part.value)
      .then(() => {
        toastSuccess('Part added successfully');
      })
      .catch(() => {
        toastError('Unable to add part');
      });
  } else if (routeName === 'viewPart') {
    await partStore
      .update(part.value)
      .then(() => {
        toastSuccess('Part updated successfully');
      })
      .catch(() => {
        toastError('Unable to update part');
      });
  }
  saveFlag.value = false;
  router.back();
}

function openLink(link: string | undefined) {
  if (!link) return;
  window.open(link, '_blank');
}

const partIsAltered = computed<boolean>(() => !isEqual(part.value, partOriginal.value));

const rules: Rules = {
  required: (val) => !!val || 'Required',
  /*barcode: (val) => {
    if (!part.value.item) return true;
    return val !== part.value.item || 'Not needed if the same as Product Number';
  },*/
};

function printItem() {}

function gotoLocation() {
  if (!part.value.location || !part.value.position) return;
  router.push({ name: 'locations', query: { loc: part.value.location, pos: part.value.position } });
}

function printLocation() {
  const loc = part.value.location;
  const pos = part.value.position;
  if (!loc || !pos) return;
  printer.printLocation({ loc, pos });
}

function addNew() {
  if (tab.value === 'docs') {
    addDoc();
  } else if (tab.value === 'notes') {
    addNote();
  }
}

function addDoc() {
  alert('add doc');
}
function addNote() {
  alert('add note');
}

const partsPerBar = computed(() => {
  if (!part.value.material?.length || !part.value.materialLength) return 0;
  return Math.floor(part.value.material.length / part.value.materialLength);
});

function assignMaterial() {
  if (!part.value.material) return;
  const material = materialsStore.materials.find((x) => x._id === part.value.material);
  if (!material) return;
  part.value.material = material;
}
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
.title h3 {
  position: relative;
  bottom: 8px;
  font-weight: normal;
}
.part-img {
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
</style>
