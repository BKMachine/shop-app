<template>
  <div v-if="loading" class="d-flex justify-center align-center loading">
    <v-progress-circular color="primary" indeterminate size="150" />
  </div>
  <v-container v-else class="container">
    <ConfirmDialog
      v-model="subComponentRemovalDialog.visible"
      confirm-text="Remove"
      :message="subComponentRemovalDialog.message"
      title="Remove Sub-Component?"
      @confirm="confirmRemoveSubComponent"
    />
    <div class="title text-center">
      <h1>{{ part.part }}</h1>
      <h3>{{ part.description }}</h3>
    </div>
    <div class="d-flex align-center justify-space-between py-4">
      <div class="part-img-wrapper">
        <img
          v-if="part.img"
          alt=""
          class="part-img"
          :src="part.img"
          @mouseenter="showExpandedImage($event)"
          @mouseleave="hideExpandedImage"
        />
        <MissingImage v-else class="part-img part-img-fallback" />
      </div>
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
            class="mb-2 clickable-chip"
            :class="{'header-rate-swatch--empty': hasNoProductPrice, [`text-${currentRateTone}`]: !hasNoProductPrice}"
            density="comfortable"
            @click="tab = 'cost'"
          >
            {{ currentRateDisplay }}
          </v-chip>
          <v-chip
            v-if="criticalNotesCount > 0"
            class="clickable-chip"
            color="error"
            density="comfortable"
            prepend-icon="mdi-alert-circle"
            variant="flat"
            @click="tab = 'notes'"
          >
            {{ criticalNotesCount }}
            Critical {{ criticalNotesCount === 1 ? 'Note' : 'Notes' }}
          </v-chip>
        </div>
      </div>
    </div>

    <teleport to="body">
      <div
        v-if="expandedImage.visible"
        class="expanded-img-container"
        :style="{ top: expandedImage.top + 'px', left: expandedImage.left + 'px' }"
      >
        <v-img class="expanded-img" :src="expandedImage.src" />
      </div>
    </teleport>

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
          v-if="canOpenPartFiles"
          class="mr-2"
          color="purple-lighten-2"
          density="comfortable"
          prepend-icon="mdi-folder-open-outline"
          variant="elevated"
          @click="openPartFiles"
        >
          Files
        </v-btn>
        <v-btn
          v-if="part.productLink"
          class="mr-2"
          color="yellow"
          density="comfortable"
          prepend-icon="mdi-open-in-new"
          variant="elevated"
          @click="openLink(part.productLink)"
        >
          Web
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
              v-model="part.productLink"
              append-inner-icon="mdi-open-in-new"
              label="Web URL"
            />
          </v-row>
          <v-row no-gutters> <PartFilesFolderCard :part="part" /> </v-row>
          <v-row no-gutters>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel class="sub-components-panel">
                <v-expansion-panel-title>
                  <div class="d-flex align-center ga-2">
                    <span>Sub-Components</span>
                    <v-chip v-if="resolvedSubComponentItems.length" size="small" variant="tonal">
                      {{ resolvedSubComponentItems.length }}
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-autocomplete
                    v-model="selectedSubComponentIds"
                    chips
                    item-title="label"
                    item-value="value"
                    :items="subComponentOptions"
                    label="Search Parts"
                    multiple
                    variant="outlined"
                  />
                  <div class="text-body-2 text-medium-emphasis mt-3">
                    Pick existing parts to treat as sub-components for this assembly.
                  </div>
                  <v-list
                    v-if="resolvedSubComponentItems.length"
                    class="parent-components-list mt-3"
                    lines="two"
                  >
                    <v-list-item
                      v-for="subItem in resolvedSubComponentItems"
                      :key="subItem.part._id"
                      :subtitle="subItem.part.description"
                      :title="subItem.part.part"
                      :to="{ name: 'viewPart', params: { id: subItem.part._id } }"
                    >
                      <template #prepend>
                        <div class="d-flex align-center ga-3">
                          <v-avatar color="secondary" size="36" variant="tonal">
                            {{ Math.max(1, Number(subItem.entry.qty) || 1) }}
                          </v-avatar>
                          <div class="parent-component-image-wrap mr-2">
                            <img
                              v-if="subItem.part.img"
                              alt=""
                              class="parent-component-image"
                              :src="subItem.part.img"
                            />
                            <MissingImage
                              v-else
                              class="parent-component-image parent-component-image--fallback"
                            />
                          </div>
                        </div>
                      </template>
                      <template #append>
                        <div class="d-flex align-center ga-2">
                          <div class="text-body-2 text-medium-emphasis parent-component-qty">
                            Qty {{ Math.max(1, Number(subItem.entry.qty) || 1) }}
                          </div>
                          <v-btn
                            color="error"
                            icon="mdi-delete"
                            size="small"
                            variant="text"
                            @click.prevent.stop="removeSubComponent(subItem.part._id)"
                          />
                          <v-icon color="medium-emphasis" icon="mdi-open-in-new" />
                        </div>
                      </template>
                    </v-list-item>
                  </v-list>
                  <div v-else class="text-body-2 text-medium-emphasis mt-3">
                    No sub-components added yet.
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel class="sub-components-panel">
                <v-expansion-panel-title>
                  <div class="d-flex align-center ga-2">
                    <span>Parent Assemblies</span>
                    <v-chip v-if="parentComponentItems.length" size="small" variant="tonal">
                      {{ parentComponentItems.length }}
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div v-if="!part._id" class="text-body-2 text-medium-emphasis">
                    Save this part first to look up parent assemblies.
                  </div>
                  <v-list
                    v-else-if="parentComponentItems.length"
                    class="parent-components-list"
                    lines="two"
                  >
                    <v-list-item
                      v-for="parentItem in parentComponentItems"
                      :key="parentItem.part._id"
                      :subtitle="parentItem.part.description"
                      :title="parentItem.part.part"
                      :to="{ name: 'viewPart', params: { id: parentItem.part._id } }"
                    >
                      <template #prepend>
                        <div class="d-flex align-center ga-3">
                          <v-avatar color="secondary" size="36" variant="tonal">
                            {{ parentItem.qty }}
                          </v-avatar>
                          <div class="parent-component-image-wrap mr-2">
                            <img
                              v-if="parentItem.part.img"
                              alt=""
                              class="parent-component-image"
                              :src="parentItem.part.img"
                            />
                            <MissingImage
                              v-else
                              class="parent-component-image parent-component-image--fallback"
                            />
                          </div>
                        </div>
                      </template>
                      <template #append>
                        <div class="d-flex align-center ga-2">
                          <div class="text-body-2 text-medium-emphasis parent-component-qty">
                            Qty {{ parentItem.qty }}
                          </div>
                          <v-icon color="medium-emphasis" icon="mdi-open-in-new" />
                        </div>
                      </template>
                    </v-list-item>
                  </v-list>
                  <div v-else class="text-body-2 text-medium-emphasis">
                    No parent components found for this part.
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-row>
        </v-window-item>

        <v-window-item eager value="material">
          <PartMaterialDetails
            :part="part"
            :sub-components="resolvedSubComponentItems"
            @update:partMaterialCost="partMaterialCost = $event"
          />
        </v-window-item>

        <v-window-item eager value="cost">
          <PartCostDetails
            :part="part"
            :partMaterialCost="partMaterialCost"
            :sub-components="resolvedSubComponentItems"
          />
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
              >
                <template #append-inner>
                  <v-dialog max-width="500">
                    <template #activator="{ props: activatorProps }">
                      <v-icon v-bind="activatorProps" icon="mdi-contrast" />
                    </template>
                    <template #default="{ isActive }">
                      <v-card>
                        <PartsAdjustStockDialog
                          :part="part"
                          @close-dialog="isActive.value = false"
                        />
                      </v-card>
                    </template>
                  </v-dialog>
                </template>
                <template #details>
                  <div class="stock-value-details mb-1">
                    <button
                      class="stock-value-toggle"
                      type="button"
                      @click="showStockValue = !showStockValue"
                    >
                      {{ showStockValue ? stockValueDisplay : 'Show Value' }}
                    </button>
                  </div>
                </template>
              </v-text-field>
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
                  <v-icon icon="mdi-map-marker-outline" @click="gotoLocation" />
                  <v-icon class="ml-2" icon="mdi-printer-outline" @click="printPartPosition" />
                </template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <PartStockGraph v-if="part._id" :id="part._id" :current-stock="part.stock" />
          </v-row>
        </v-window-item>

        <v-window-item value="docs"> <PartDocumentsDetails :part="part" /> </v-window-item>
        <v-window-item value="images">
          <PartImagesDetails :part="part" @image-selected="onPartImageSelected" />
        </v-window-item>
        <v-window-item value="notes">
          <PartNotesDetails :part="part" @notes-changed="loadCriticalNotesCount" />
        </v-window-item>
      </v-window>
    </v-form>

    <ImageManagerDialog
      v-if="part"
      v-model="imageManagerVisible"
      :entity-id="part._id"
      entity-type="part"
      :has-image="Boolean(part.img)"
      :title="part.description"
      @image-selected="onPartImageSelected"
    />
  </v-container>
</template>

<script setup lang="ts">
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CustomerSelect from '@/components/CustomerSelect.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import MissingImage from '@/components/MissingImage.vue';
import PartCostDetails from '@/components/parts/PartCostDetails.vue';
import PartDocumentsDetails from '@/components/parts/PartDocumentsDetails.vue';
import PartFilesFolderCard from '@/components/parts/PartFilesFolderCard.vue';
import PartImagesDetails from '@/components/parts/PartImagesDetails.vue';
import PartMaterialDetails from '@/components/parts/PartMaterialDetails.vue';
import PartNotesDetails from '@/components/parts/PartNotesDetails.vue';
import PartStockGraph from '@/components/parts/PartStockGraph.vue';
import PartsAdjustStockDialog from '@/components/parts/PartsAdjustStockDialog.vue';
import axios from '@/plugins/axios';
import printer from '@/plugins/printer';
import { getToneForRate } from '@/plugins/rates_theme';
import { calculateAssemblyCycleMinutes, calculateRatePerHour, isNumber } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { useFolderHelperState } from '@/state/folderHelper';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();
const { helperStatus, loadFolderHelperManifest, normalizeFolderPath, openFolderWithHelper } =
  useFolderHelperState();

const showAdd = computed(() => {
  return false;
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
  import.meta.env.PROD ? 'general' : 'general',
);
const id = computed(() => router.currentRoute.value.params.id);
const valid = ref(false);
const loading = ref(false);
const saveFlag = ref(false);
const partMaterialCost = ref(0);
const imageManagerVisible = ref(false);
const criticalNotesCount = ref(0);
const showStockValue = ref(false);
const subComponentRemovalDialog = ref({
  visible: false,
  partId: '',
  message: '',
});
const hasNoProductPrice = computed(() => {
  return part.value.price == null || part.value.price === 0;
});
const subComponentEntries = computed<PartSubComponent[]>(() => part.value.subComponentIds || []);
const selectedSubComponentIds = computed<string[]>({
  get() {
    return subComponentEntries.value.map((entry) => String(entry.partId));
  },
  set(ids) {
    const existingQtyById = new Map(
      subComponentEntries.value.map((entry) => [
        String(entry.partId),
        Math.max(1, Number(entry.qty) || 1),
      ]),
    );
    part.value.subComponentIds = ids.map((partId) => ({
      partId,
      qty: existingQtyById.get(partId) || 1,
    }));
  },
});
const partById = computed(() => {
  return new Map(partStore.parts.map((candidate) => [candidate._id, candidate]));
});
const resolvePart = (partId: string) => partById.value.get(partId);
const partDependsOnCurrent = (candidateId: string, visited = new Set<string>()): boolean => {
  if (!part.value._id || visited.has(candidateId)) return false;
  const candidate = resolvePart(candidateId);
  if (!candidate) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(candidateId);

  return (candidate.subComponentIds || []).some((subComponent) => {
    const normalizedId = String(subComponent.partId);
    if (normalizedId === part.value._id) return true;
    return partDependsOnCurrent(normalizedId, nextVisited);
  });
};
const disallowedSubComponentIds = computed(() => {
  return new Set(
    partStore.parts
      .filter(
        (candidate) => candidate._id === part.value._id || partDependsOnCurrent(candidate._id),
      )
      .map((candidate) => candidate._id),
  );
});
const resolvedSubComponentItems = computed(() => {
  return subComponentEntries.value
    .map((entry) => {
      const subPart = resolvePart(String(entry.partId));
      if (!subPart || subPart._id === part.value._id) return null;
      return {
        key: String(entry.partId),
        entry,
        part: subPart,
      };
    })
    .filter((item): item is { key: string; entry: PartSubComponent; part: Part } => Boolean(item));
});
const parentComponentItems = computed(() => {
  if (!part.value._id) return [];

  return partStore.parts
    .map((candidate) => {
      const parentEntry = (candidate.subComponentIds || []).find(
        (entry) => String(entry.partId) === part.value._id,
      );
      if (!parentEntry || candidate._id === part.value._id) return null;

      return {
        part: candidate,
        qty: Math.max(1, Number(parentEntry.qty) || 1),
      };
    })
    .filter((item): item is { part: Part; qty: number } => Boolean(item))
    .sort((a, b) => a.part.part.localeCompare(b.part.part));
});
const subComponentOptions = computed(() => {
  return partStore.parts
    .filter((candidate) => !disallowedSubComponentIds.value.has(candidate._id))
    .slice()
    .sort((a, b) => a.part.localeCompare(b.part))
    .map((candidate) => ({
      label: `${candidate.part} - ${candidate.description}`,
      value: candidate._id,
    }));
});
const effectiveTotalCycleMinutes = computed(() => {
  return calculateAssemblyCycleMinutes(part.value, resolvePart);
});

const currentRate = computed(() => {
  if (hasNoProductPrice.value) return 0;
  const rate = calculateRatePerHour(
    part.value.price,
    partMaterialCost.value,
    effectiveTotalCycleMinutes.value,
  );
  return Number.isFinite(rate) ? rate : 0;
});

const currentRateTone = computed(() => getToneForRate(currentRate.value));

const currentRateDisplay = computed(() => {
  return `$${currentRate.value.toFixed(2)}/hr`;
});
const stockValue = computed(() => (Number(part.value.stock) || 0) * Number(part.value.price || 0));
const stockValueDisplay = computed(() => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(stockValue.value);
});

const normalizedPartFilesPath = computed(() => normalizeFolderPath(part.value.partFilesPath));
const canOpenPartFiles = computed(() => {
  return helperStatus.value === 'likely-installed' && Boolean(normalizedPartFilesPath.value);
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
  void loadFolderHelperManifest();

  if (!partStore.rawParts.length && !partStore.loading) {
    partStore.fetch();
  }

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

watch(
  () => partStore.trigger.partID,
  (partId) => {
    if (router.currentRoute.value.name !== 'viewPart') return;
    if (!partId || partId !== router.currentRoute.value.params.id) return;

    const match = partStore.rawParts.find((candidate) => candidate._id === partId);
    if (!match) return;

    if (partIsAltered.value && saveFlag.value === false) {
      alert('Part was updated. Local changes will be lost.');
    }

    applyFetchedPart(match);
  },
);

function fetchPart(showSpinner: boolean = true) {
  const { id } = router.currentRoute.value.params;
  if (showSpinner) loading.value = true;
  axios
    .get<Part>(`/parts/${id}`)
    .then(({ data }) => {
      applyFetchedPart(data);
    })
    .catch(() => {
      alert('Part not found.');
    })
    .finally(() => {
      loading.value = false;
    });
}

function applyFetchedPart(source: Part) {
  const mergedPart = { ...defaultPartValues, ...source };
  mergedPart.subComponentIds = (mergedPart.subComponentIds || [])
    .map((entry) => {
      if (typeof entry === 'string') {
        return { partId: entry, qty: 1 };
      }

      return {
        partId: String(entry.partId),
        qty: Math.max(1, Number(entry.qty) || 1),
      };
    })
    .filter(
      (entry, index, array) =>
        array.findIndex((candidate) => candidate.partId === entry.partId) === index &&
        entry.partId !== mergedPart._id,
    );
  part.value = cloneDeep(mergedPart);
  partOriginal.value = cloneDeep(mergedPart);
  void loadCriticalNotesCount();
}

async function savePart() {
  const routeName = router.currentRoute.value.name;
  saveFlag.value = true;
  part.value.subComponentIds = (part.value.subComponentIds || []).filter(
    (subComponent, index, array) => {
      const normalizedId = String(subComponent.partId);
      return (
        array.findIndex((candidate) => String(candidate.partId) === normalizedId) === index &&
        !disallowedSubComponentIds.value.has(normalizedId)
      );
    },
  );
  part.value.subComponentIds = (part.value.subComponentIds || []).map((subComponent) => ({
    partId: String(subComponent.partId),
    qty: Math.max(1, Number(subComponent.qty) || 1),
  }));
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

async function openPartFiles() {
  if (!normalizedPartFilesPath.value) return;

  const didLaunch = await openFolderWithHelper(normalizedPartFilesPath.value);
  if (!didLaunch) {
    toastError('Folder Helper was not detected. Install it on this PC first.');
  }
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
    subComponentIds: (value.subComponentIds || [])
      .map((subComponent) => ({
        partId: String(subComponent.partId),
        qty: Math.max(1, Number(subComponent.qty) || 1),
      }))
      .sort((a, b) => a.partId.localeCompare(b.partId)),
  };
}

const partIsAltered = computed<boolean>(() => {
  return !isEqual(toComparablePart(part.value), toComparablePart(partOriginal.value));
});

const requiredRule = (val: string) => !!val || 'Required';

function gotoLocation() {
  if (!part.value.location || !part.value.position) return;
  router.push({ name: 'locations', query: { loc: part.value.location, pos: part.value.position } });
}

function removeSubComponent(partId: string) {
  if (!partId) return;
  const subComponent = resolvePart(partId);
  subComponentRemovalDialog.value = {
    visible: true,
    partId,
    message: subComponent
      ? `Remove ${subComponent.part} - ${subComponent.description} from this part's sub-components?`
      : 'Remove this sub-component from the part?',
  };
}

function confirmRemoveSubComponent() {
  const { partId } = subComponentRemovalDialog.value;
  if (!partId) return;
  selectedSubComponentIds.value = selectedSubComponentIds.value.filter((id) => id !== partId);
  subComponentRemovalDialog.value = {
    visible: false,
    partId: '',
    message: '',
  };
}

function printLocation() {
  const loc = part.value.location;
  const pos = part.value.position;
  if (!loc || !pos) return;
  printer.printLocation({ loc, pos });
}

function printPartPosition() {
  const partId = part.value._id;
  const labelPart = part.value.part;
  const description = part.value.description;
  const loc = part.value.location;
  const pos = part.value.position;
  const imageUrl = part.value.img?.trim()
    ? new URL(part.value.img, window.location.origin).toString()
    : undefined;

  if (!partId || !labelPart || !description || !loc || !pos) return;
  printer.printPartPosition({
    partId,
    part: labelPart,
    description,
    loc,
    pos,
    partImageUrl: imageUrl,
  });
}

function addNew() {
  if (tab.value === 'images') {
    // Images are managed via the PartImagesDetails component
    // No action needed here as the component has its own buttons
  }
}

function onPartImageSelected(payload: { imageId: string; url: string; isMain?: boolean }) {
  if (!payload.isMain) return;

  part.value.img = payload.url;
  if (part.value._id) partStore.updatePartImage(part.value._id, payload.url);
}

const expandedImage = ref({
  visible: false,
  src: '',
  top: 0,
  left: 0,
});

function showExpandedImage(event: MouseEvent) {
  if (!part.value.img) return;
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  expandedImage.value = {
    visible: true,
    src: part.value.img,
    top: rect.top,
    left: rect.right,
  };
}

function hideExpandedImage() {
  expandedImage.value = { visible: false, src: '', top: 0, left: 0 };
}

async function loadCriticalNotesCount() {
  if (!part.value._id) {
    criticalNotesCount.value = 0;
    return;
  }

  try {
    const { data } = await axios.get<MyPartNoteData[]>(`/parts/${part.value._id}/notes`);
    criticalNotesCount.value = data.filter((note) => note.priority === 'critical').length;
  } catch (error) {
    console.error('Failed to load critical notes count', error);
    criticalNotesCount.value = 0;
  }
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
  cursor: zoom-in;
}

.part-img-wrapper {
  position: relative;
  display: inline-flex;
  align-items: flex-start;
}

.part-img.part-img-fallback {
  width: 100px;
  max-width: 100px;
  min-height: 100px;
  margin: 4px 0;
  border-radius: 8px;
}

.expanded-img-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}

.expanded-img {
  width: 360px;
  max-height: 360px;
  border: 1px solid #ccc;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
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

.clickable-chip {
  cursor: pointer;
}

.stock-value-details {
  min-height: 18px;
  padding-top: 2px;
}

.stock-value-toggle {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 300;
  color: #1e88e5;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}

.v-window-item {
  padding: 0 1rem 1rem 1rem;
}
.header-rate-swatch--empty {
  background: white;
}

.parent-components-list {
  padding: 0;
}

.parent-component-qty {
  white-space: nowrap;
}

.parent-component-image-wrap {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f4f7fb;
  border: 1px solid #d8dee8;
  overflow: hidden;
}

.parent-component-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.parent-component-image--fallback {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 4px;
  font-size: 9px;
}
</style>
