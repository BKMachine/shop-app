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
          <!--   <v-chip :class="{ active: part.autoReorder }" class="mb-2" density="comfortable">
            Auto Reorder
          </v-chip>
          <v-chip :class="{ active: part.onOrder }" density="comfortable">On Order</v-chip>-->
        </div>
      </div>
    </div>
    <v-tabs v-model="tab" bg-color="#555555" class="mb-4" color="secondary">
      <v-tab value="general"> General </v-tab>
      <v-tab value="material"> Material </v-tab>
      <v-tab value="cost"> Cost </v-tab>
      <v-tab value="stock"> Stock </v-tab>
      <v-tab value="docs"> Documents </v-tab>
      <v-tab value="notes"> Notes </v-tab>
      <v-spacer />
      <div class="d-flex align-center">
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
              <v-select
                v-model="part.customer"
                class="ml-2"
                clearable
                item-title="name"
                item-value="_id"
                :items="customerStore.customers"
                label="Customer"
                :rules="[requiredRule]"
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template #prepend>
                      <v-avatar rounded="0">
                        <v-img class="customer-logo" :src="item.raw.logo" />
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
        </v-window-item>

        <v-window-item value="material">
          <v-row>
            <v-col cols="6">
              <v-card class="mb-4" variant="outlined">
                <v-card-text>
                  <v-row>
                    <v-col cols="12">
                      <v-autocomplete
                        v-model="part.material"
                        hide-details
                        item-title="description"
                        item-value="_id"
                        :items="sortedMaterials"
                        label="Material"
                        @update:model-value="assignMaterial"
                      />
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="6">
                      <v-radio-group
                        v-model="part.materialCutType"
                        hide-details
                        inline
                        label="Cut Type"
                      >
                        <v-radio label="Blanks" value="blanks" />
                        <v-radio label="Bars" value="bars" />
                      </v-radio-group>
                      <v-btn
                        v-if="part.materialCutType === 'bars'"
                        class="mt-1 px-0 text-caption-2 swiss-defaults-btn"
                        color="primary"
                        density="compact"
                        size="x-small"
                        variant="text"
                        @click="setSwissMaterial"
                      >
                        Use Swiss defaults
                      </v-btn>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model.number="part.materialLength"
                        hint="Material usage per part"
                        label="Length per Part (in)"
                        min="0"
                        :rules="[partLengthRule]"
                        type="number"
                        @keydown="onlyAllowNumeric($event)"
                      />
                    </v-col>
                  </v-row>
                  <v-row>
                    <template v-if="part.materialCutType === 'bars'">
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="part.barLength"
                          label="Cut Bar Length (in)"
                          min="0"
                          :rules="[cutBarLengthRule]"
                          type="number"
                          @keydown="onlyAllowNumeric($event)"
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="part.remnantLength"
                          label="Remnant Length (in)"
                          min="0"
                          :rules="[remnantLengthRule]"
                          type="number"
                          @keydown="onlyAllowNumeric($event)"
                        />
                      </v-col>
                    </template>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="6">
              <v-card color="blue-grey" variant="tonal">
                <v-card-title class="text-subtitle-2 pa-3 pb-2"> Yield Summary </v-card-title>
                <v-card-text>
                  <v-table
                    v-if="part.materialCutType !== 'bars'"
                    class="rounded bg-transparent"
                    density="compact"
                  >
                    <tbody>
                      <tr>
                        <td class="text-medium-emphasis text-caption row-1">Full Bar</td>
                        <td class="text-body-2">
                          {{ partsPerBarDetails.fullBarLength }}" ÷
                          {{ partsPerBarDetails.materialLength }}"
                        </td>
                        <td class="text-right">
                          <v-chip class="yield-chip" color="success" size="small" variant="elevated"
                            >{{ partsPerBarDetails.totalParts }}
                            parts / bar</v-chip
                          >
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <v-table v-else class="rounded bg-transparent" density="compact">
                    <tbody>
                      <tr>
                        <td class="text-medium-emphasis text-caption row-1">Full Bar</td>
                        <td class="text-body-2">
                          {{ partsPerBarDetails.fullBarLength }}" ÷
                          {{ partsPerBarDetails.barLength }}"
                        </td>
                        <td class="text-right">
                          <v-chip color="primary" size="small" variant="tonal"
                            >{{ partsPerBarDetails.subBars }}
                            cut bars</v-chip
                          >
                        </td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis text-caption row-1">Cut Bar</td>
                        <td class="text-body-2">
                          {{ partsPerBarDetails.barLength }}" −
                          {{ partsPerBarDetails.remnantLength }}" =
                          {{ partsPerBarDetails.usablePerSubBar }}" usable
                        </td>
                        <td class="text-right">
                          <v-chip color="primary" size="small" variant="tonal"
                            >{{ partsPerBarDetails.partsPerSubBar }}
                            parts / cut bar</v-chip
                          >
                        </td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis text-caption row-1">Remainder</td>
                        <td class="text-body-2">
                          {{ partsPerBarDetails.remainderLength }}" −
                          {{ partsPerBarDetails.remnantLength }}" =
                          {{ partsPerBarDetails.usableRemainder }}" usable
                        </td>
                        <td class="text-right">
                          <v-chip color="primary" size="small" variant="tonal"
                            >{{ partsPerBarDetails.remainderParts }}
                            parts / remainder</v-chip
                          >
                        </td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis text-caption font-weight-bold">Total</td>
                        <td class="text-body-2">
                          ({{ partsPerBarDetails.subBars }}
                          × {{ partsPerBarDetails.partsPerSubBar }}) +
                          {{ partsPerBarDetails.remainderParts }}
                        </td>
                        <td class="text-right">
                          <v-chip class="yield-chip" color="success" size="small" variant="elevated"
                            >{{ partsPerBarDetails.totalParts }}
                            parts / bar</v-chip
                          >
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
                <v-divider />
                <v-card-text class="py-2">
                  <v-table class="rounded bg-transparent" density="compact">
                    <tbody>
                      <tr>
                        <td class="text-medium-emphasis text-body-2 row-1">Material Cost:</td>
                        <td class="text-body-2">
                          <div class="d-flex align-center ga-2">
                            <v-chip color="purple-darken-2" variant="tonal"
                              >${{ materialCost.toFixed(2) }}</v-chip
                            >
                            <span class="text-medium-emphasis">÷</span>
                            <v-chip variant="outlined">{{ partsPerBar }} parts</v-chip>
                          </div>
                        </td>
                        <td class="text-right">
                          <v-chip
                            class="font-weight-bold yield-chip"
                            color="success"
                            variant="elevated"
                            >${{ partMaterialCost }}
                            / part</v-chip
                          >
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-window-item>

        <v-window-item value="cost">
          <v-row no-gutters>
            <v-col cols="4">
              <v-text-field
                v-model.number="part.price"
                label="Product Price (Customer)"
                min="0"
                prefix="$"
                type="number"
              />
            </v-col>
          </v-row>
          <v-divider class="my-1" />
          <div class="mb-2 font-weight-bold">Cycle Times</div>
          <v-row v-for="(cycle, idx) in part.cycleTimes || []" :key="idx" class="mb-2">
            <v-col cols="5">
              <v-text-field v-model="cycle.operation" dense label="Operation Name" />
            </v-col>
            <v-col cols="5">
              <v-text-field
                v-model.number="cycle.time"
                dense
                label="Cycle Time (min)"
                min="0"
                type="number"
              />
            </v-col>
            <v-col cols="2">
              <v-btn color="red" icon @click="part.cycleTimes.splice(idx, 1)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-col>
          </v-row>
          <v-btn
            color="primary"
            variant="outlined"
            @click="part.cycleTimes ? part.cycleTimes.push({operation: '', time: 0}) : part.cycleTimes = [{operation: '', time: 0}]"
          >
            <v-icon left> mdi-plus </v-icon>Add Cycle Time
          </v-btn>
          <v-divider class="my-4" />
          <v-row>
            <v-col cols="4">
              <div>
                <b>Total Cycle Time:</b>
                {{ (part.cycleTimes || []).reduce((t, c) => t + (c.time || 0), 0) }}
                min
              </div>
            </v-col>
            <v-col cols="4">
              <div><b>Estimated Material Cost:</b> ${{ partMaterialCost }}</div>
            </v-col>
            <v-col cols="4">
              <div>
                <b>Estimated Profit:</b>
                ${{ (part.price && materialCost) ? (part.price - materialCost).toFixed(2) : '0.00' }}
              </div>
            </v-col>
          </v-row>
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
              >
                <template #append-inner>
                  <!--                  <v-icon icon="mdi-map-marker-outline" @click="gotoLocation"></v-icon>
                  <v-icon icon="mdi-printer-outline" class="ml-2" @click="printLocation" />-->
                </template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <PartStockGraph v-if="part._id" :id="part._id" :current-stock="part.stock" />
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
import { isNumber, onlyAllowNumeric } from '@/plugins/utils';
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

const defaultPartValues = {
  materialCutType: 'blanks',
  barLength: 0,
  remnantLength: 0,
} as const;

const part = ref<Part>({} as Part);
const partOriginal = ref<Part>({} as Part);

const tab = ref<'general' | 'material' | 'stock' | 'docs' | 'notes'>(
  import.meta.env.PROD ? 'general' : 'material',
);
const id = computed(() => router.currentRoute.value.params.id);
const valid = ref(false);
const loading = ref(false);
const saveFlag = ref(false);

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  const routeParams = router.currentRoute.value.params;

  if (routeName === 'createPart') {
    part.value = { ...part.value, ...defaultPartValues };
    partOriginal.value = { ...partOriginal.value, ...defaultPartValues };
  }

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
    .get<Part>(`/parts/${id}`)
    .then(({ data }) => {
      part.value = { ...defaultPartValues, ...data };
      partOriginal.value = { ...defaultPartValues, ...data };
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

const partLengthRule = (val: string) => {
  const partLength = Number(val) || 0;
  const totalBarLength = Number(selectedMaterialLength.value) || 0;
  return partLength <= totalBarLength || 'Length per part cannot exceed total bar length';
};

const cutBarLengthRule = (val: string) => {
  if (part.value.materialCutType !== 'bars') return true;
  const cutBarLength = Number(val) || 0;
  const totalBarLength = Number(selectedMaterialLength.value) || 0;
  if (!cutBarLength || !totalBarLength) return true;
  return cutBarLength <= totalBarLength || 'Cut bar length cannot exceed total bar length';
};

const remnantLengthRule = (val: string) => {
  if (part.value.materialCutType !== 'bars') return true;
  const remnantLength = Number(val) || 0;
  const cutBarLength = Number(part.value.barLength) || 0;
  if (!cutBarLength) return true;
  return remnantLength <= cutBarLength || 'Remnant length cannot exceed cut bar length';
};

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

const selectedMaterialLength = computed(() => {
  if (!part.value.material) return 0;
  if (typeof part.value.material !== 'string') return part.value.material.length || 0;
  const material = materialsStore.materials.find((x) => x._id === part.value.material);
  return material?.length || 0;
});

const partsPerBarDetails = computed(() => {
  const cutType = part.value.materialCutType || 'blanks';
  const fullBarLength = Number(selectedMaterialLength.value) || 0;
  const materialLength = Number(part.value.materialLength) || 0;

  if (!fullBarLength || !materialLength) {
    return {
      cutType,
      fullBarLength,
      materialLength,
      barLength: Number(part.value.barLength) || 0,
      remnantLength: Number(part.value.remnantLength) || 0,
      subBars: 0,
      usablePerSubBar: 0,
      partsPerSubBar: 0,
      remainderLength: 0,
      usableRemainder: 0,
      remainderParts: 0,
      totalParts: 0,
    };
  }

  if (cutType !== 'bars') {
    return {
      cutType,
      fullBarLength,
      materialLength,
      barLength: 0,
      remnantLength: 0,
      subBars: 0,
      usablePerSubBar: 0,
      partsPerSubBar: 0,
      remainderLength: 0,
      usableRemainder: 0,
      remainderParts: 0,
      totalParts: Math.floor(fullBarLength / materialLength),
    };
  }

  const barLength = Number(part.value.barLength) || 0;
  const remnantLength = Number(part.value.remnantLength) || 0;
  if (!barLength || barLength <= remnantLength) {
    return {
      cutType,
      fullBarLength,
      materialLength,
      barLength,
      remnantLength,
      subBars: 0,
      usablePerSubBar: 0,
      partsPerSubBar: 0,
      remainderLength: 0,
      usableRemainder: 0,
      remainderParts: 0,
      totalParts: 0,
    };
  }

  const subBars = Math.floor(fullBarLength / barLength);
  const remainderLength = fullBarLength % barLength;
  const usablePerSubBar = barLength - remnantLength;
  const partsPerSubBar = Math.floor(usablePerSubBar / materialLength);
  const usableRemainder = Math.max(remainderLength - remnantLength, 0);
  const remainderParts = Math.floor(usableRemainder / materialLength);

  return {
    cutType,
    fullBarLength,
    materialLength,
    barLength,
    remnantLength,
    subBars,
    usablePerSubBar,
    partsPerSubBar,
    remainderLength,
    usableRemainder,
    remainderParts,
    totalParts: subBars * partsPerSubBar + remainderParts,
  };
});

const partsPerBar = computed(() => {
  return partsPerBarDetails.value.totalParts;
});

function assignMaterial() {
  if (!part.value.material) return;
  const material = materialsStore.materials.find((x) => x._id === part.value.material);
  if (!material) return;
  part.value.material = material;
}

const materialCost = computed(() => {
  if (!part.value.material) return 0;
  if (typeof part.value.material === 'string') return 0;
  const feet = (part.value.material.length || 0) / 12;
  return feet * (part.value.material.costPerFoot || 0);
});

const partMaterialCost = computed(() => {
  if (!partsPerBar.value) return 0;
  return Math.round((materialCost.value / partsPerBar.value) * 100) / 100;
});

const sortedMaterials = computed(() => {
  return materialsStore.materials.slice().sort((a, b) => {
    if (a.description < b.description) return -1;
    if (a.description > b.description) return 1;
    return 0;
  });
});

function setSwissMaterial() {
  part.value.barLength = part.value.material?.length || 0;
  part.value.remnantLength = 12;
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

.yield-chip {
  min-width: 120px;
  justify-content: center;
}

.row-1 {
  width: 140px;
}

.swiss-defaults-btn {
  position: relative;
  left: 16px;
}
</style>
