<template>
  <div v-if="loading" class="d-flex justify-center align-center loading">
    <v-progress-circular color="primary" indeterminate size="150" />
  </div>
  <v-container v-else class="container">
    <div class="title text-center">
      <h1>{{ part.part }}</h1>
      <h3>{{ part.description }}</h3>
    </div>
    <div class="d-flex align-center justify-space-between py-4">
      <img alt="" class="part-img" :src="part.img" />
      <div class="d-flex">
        <div class="d-flex align-center flex-column mr-4">
          <div class="d-flex flex-column align-center">
            <div class="stock">{{ part.stock }}</div>
            <div>In Stock</div>
            <div class="location">
              <span v-if="part.location"> {{ part.location }}</span>
              <span v-if="part.position"> | {{ part.position }}</span>
            </div>
          </div>
        </div>
        <div class="d-flex flex-column align-end justify-center">
          <v-chip
            class="mb-2 rate-chip"
            :class="[`rate-chip--${currentRateTone}`, `text-${currentRateTone}`]"
            density="comfortable"
            @click="tab = 'cost'"
          >
            {{ currentRateDisplay }}
          </v-chip>
        </div>
      </div>
    </div>

    <v-tabs v-model="tab" bg-color="#555555" class="mb-4" color="secondary">
      <v-tab value="general"> General </v-tab>
      <v-tab value="material"> Material </v-tab>
      <v-tab value="cost"> Cost </v-tab>
      <v-tab value="stock"> Stock </v-tab>
      <v-tab value="docs"> Documents </v-tab>
      <v-tab value="images"> Images </v-tab>
      <v-tab value="notes"> Notes </v-tab>
      <v-spacer />
      <div class="d-flex align-center">
        <v-btn
          v-if="part.productLink"
          class="mr-2"
          color="yellow"
          density="comfortable"
          prepend-icon="mdi-open-in-new"
          variant="elevated"
          @click="openLink(part.productLink)"
        >
          Product Page
        </v-btn>
        <v-btn
          v-if="showAdd"
          class="mr-2"
          color="blue"
          density="comfortable"
          prepend-icon="mdi-plus"
          variant="elevated"
          @click="addNew"
        >
          Add
        </v-btn>
        <v-btn
          class="mr-2"
          color="green"
          density="comfortable"
          :disabled="!partIsAltered || !valid"
          prepend-icon="mdi-content-save-outline"
          variant="elevated"
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
                :rules="[requiredRule]"
              > </v-text-field>
            </v-col>
            <v-col cols="1"> <v-text-field v-model="part.revision" label="Rev" /> </v-col>
            <v-col cols="6">
              <CustomerSelect
                v-model="part.customer"
                class="ml-2"
                clearable
                label="Customer"
                :rules="[requiredRule]"
              />
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="12">
              <v-text-field
                v-model="part.description"
                label="Description"
                :rules="[requiredRule]"
              />
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="part.img"
              append-inner-icon="mdi-image-outline"
              label="Part Image URL"
            />
          </v-row>
          <v-row no-gutters>
            <v-text-field
              v-model="part.productLink"
              append-inner-icon="mdi-open-in-new"
              label="Product Page URL"
            />
          </v-row>
        </v-window-item>

        <v-window-item eager value="material">
          <PartMaterialDetails :part="part" @update:partMaterialCost="partMaterialCost = $event" />
        </v-window-item>

        <v-window-item eager value="cost">
          <PartCostDetails :part="part" :partMaterialCost="partMaterialCost" />
        </v-window-item>

        <v-window-item value="stock">
          <v-row no-gutters>
            <v-col cols="4">
              <v-text-field
                v-model.number="part.stock"
                class="mr-2"
                label="Stock Qty"
                min="0"
                type="number"
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
                @update:model-value="part.position = part.position?.toUpperCase()"
              > </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <PartStockGraph v-if="part._id" :id="part._id" :current-stock="part.stock" />
          </v-row>
        </v-window-item>

        <v-window-item value="docs"> DOCS </v-window-item>
        <v-window-item value="images"> IMAGES </v-window-item>
        <v-window-item value="notes"> NOTES </v-window-item>
      </v-window>
    </v-form>
  </v-container>
</template>

<script setup lang="ts">
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CustomerSelect from '@/components/CustomerSelect.vue';
import PartCostDetails from '@/components/parts/PartCostDetails.vue';
import PartMaterialDetails from '@/components/parts/PartMaterialDetails.vue';
import PartStockGraph from '@/components/parts/PartStockGraph.vue';
import axios from '@/plugins/axios';
import printer from '@/plugins/printer';
import {
  calculateRatePerHour,
  calculateTotalCycleMinutes,
  getToneForRate,
  isNumber,
} from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();

const showAdd = computed(() => {
  const tabs = ['docs', 'notes', 'images'];
  return tabs.includes(tab.value);
});

const defaultPartValues = {
  barLength: 0,
  remnantLength: 0,
  customerSuppliedMaterial: false,
  materialCutType: 'blanks',
} as const;

const part = ref<Part>({} as Part);
const partOriginal = ref<Part>({} as Part);

const tab = ref<'general' | 'material' | 'cost' | 'stock' | 'docs' | 'notes' | 'images'>(
  import.meta.env.PROD ? 'general' : 'cost',
);
const id = computed(() => router.currentRoute.value.params.id);
const valid = ref(false);
const loading = ref(false);
const saveFlag = ref(false);
const partMaterialCost = ref(0);

const currentRate = computed(() => {
  const totalCycleMinutes = calculateTotalCycleMinutes(part.value.cycleTimes);
  const rate = calculateRatePerHour(part.value.price, partMaterialCost.value, totalCycleMinutes);
  return Number.isFinite(rate) ? rate : 0;
});

const currentRateTone = computed(() => getToneForRate(currentRate.value));

const currentRateDisplay = computed(() => {
  return `$${currentRate.value.toFixed(2)}/hr`;
});

function setTabFromQuery() {
  const routeTab = router.currentRoute.value.query.tab;
  const validTabs = ['general', 'material', 'cost', 'stock', 'docs', 'notes', 'images'] as const;

  if (typeof routeTab === 'string' && validTabs.includes(routeTab as (typeof validTabs)[number])) {
    tab.value = routeTab as typeof tab.value;
  }
}

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  const routeParams = router.currentRoute.value.params;

  setTabFromQuery();

  if (routeName === 'createPart') {
    part.value = { ...part.value, ...defaultPartValues };
    partOriginal.value = { ...partOriginal.value, ...defaultPartValues };
  }

  // Fetch the part from the DB if we are viewing a part and not creating a new part
  if (routeName === 'viewPart') fetchPart();

  // Fetch the tool from the DB if the route changes
  watch(id, () => {
    setTabFromQuery();
    fetchPart();
  });

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

onBeforeUnmount(() => {
  // Store the part we were viewing to slightly highlight the row in the part list
  partStore.setLastId(part.value._id);
});

function fetchPart(showSpinner: boolean = true) {
  const { id } = router.currentRoute.value.params;
  if (showSpinner) loading.value = true;
  axios
    .get<Part>(`/parts/${id}`)
    .then(({ data }) => {
      const mergedPart = { ...defaultPartValues, ...data };
      part.value = cloneDeep(mergedPart);
      partOriginal.value = cloneDeep(mergedPart);
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

function getCustomerId(customer: Part['customer'] | undefined): string | undefined {
  if (!customer) return undefined;
  return typeof customer === 'string' ? customer : customer._id;
}

function getMaterialId(material: Part['material'] | undefined): string | undefined {
  if (!material) return undefined;
  return typeof material === 'string' ? material : material._id;
}

function toComparablePart(value: Part) {
  return {
    ...value,
    customer: getCustomerId(value.customer),
    material: getMaterialId(value.material),
  };
}

const partIsAltered = computed<boolean>(() => {
  return !isEqual(toComparablePart(part.value), toComparablePart(partOriginal.value));
});

const requiredRule = (val: string) => !!val || 'Required';

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

.rate-chip {
  justify-content: center;
  font-weight: 600;
  cursor: pointer;
}

.rate-chip--rateLow {
  background: rgba(var(--v-theme-rateLow), 0.18);
}

.rate-chip--rateWarn {
  background: rgba(var(--v-theme-rateWarn), 0.18);
}

.rate-chip--rateOk {
  background: rgba(var(--v-theme-rateOk), 0.18);
}
</style>
