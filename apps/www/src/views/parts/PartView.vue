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
    <LeaveUnsavedChangesDialog
      v-model="leaveDialogVisible"
      :changes="changedPartFields"
      :confirm-disabled="!canSavePart"
      :loading="saveFlag"
      @confirm="saveAndContinue"
      @discard="leaveWithoutSaving"
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
        <v-checkbox
          v-if="showNeedsReviewControl"
          v-model="part.needsReview"
          class="mr-2"
          color="warning"
          density="comfortable"
          hide-details
          label="Needs Review"
        />
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
                    <span v-if="resolvedSubComponentItems.length" class="expansion-count-badge">
                      {{ resolvedSubComponentItems.length }}
                    </span>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-autocomplete
                    v-model="subComponentSearchSelection"
                    v-model:search="subComponentSearchTerm"
                    clearable
                    item-title="label"
                    item-value="value"
                    :items="subComponentOptions"
                    label="Search Parts"
                    :loading="subComponentSearchLoading"
                    no-filter
                    placeholder="Start typing to search..."
                    variant="outlined"
                  />
                  <div class="text-body-2 text-medium-emphasis mt-3">
                    Pick existing parts to treat as sub-components for this assembly.
                  </div>
                  <draggable
                    v-if="draggableSubComponentEntries.length"
                    v-model="draggableSubComponentEntries"
                    class="parent-components-list mt-3"
                    drag-class="sub-component-row--dragging"
                    ghost-class="sub-component-row--ghost"
                    handle=".sub-component-drag-handle"
                    item-key="partId"
                    tag="div"
                  >
                    <template #item="{ element }">
                      <v-list
                        v-if="resolveSubComponentItem(element)"
                        class="sub-component-draggable-list"
                        lines="two"
                      >
                        <v-list-item
                          :subtitle="resolveSubComponentItem(element)?.part.description"
                          :title="resolveSubComponentItem(element)?.part.part"
                          :to="{ name: 'viewPart', params: { id: resolveSubComponentItem(element)?.part._id } }"
                        >
                          <template #prepend>
                            <div class="d-flex align-center ga-3">
                              <span class="sub-component-drag-handle">
                                <v-icon icon="mdi-drag" size="small" />
                              </span>
                              <div class="parent-component-image-wrap mr-2">
                                <img
                                  v-if="resolveSubComponentItem(element)?.part.img"
                                  alt=""
                                  class="parent-component-image"
                                  :src="resolveSubComponentItem(element)?.part.img"
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
                              <div class="sub-component-qty-field" @click.stop>
                                <v-text-field
                                  v-model.number="element.qty"
                                  density="compact"
                                  hide-details
                                  label="Qty"
                                  min="1"
                                  type="number"
                                  variant="outlined"
                                  @click.stop
                                  @keydown="onlyAllowNumeric($event)"
                                />
                              </div>
                              <v-btn
                                color="error"
                                icon="mdi-delete"
                                size="small"
                                variant="text"
                                @click.prevent.stop="removeSubComponent(String(element.partId))"
                              />
                              <v-icon color="medium-emphasis" icon="mdi-open-in-new" />
                            </div>
                          </template>
                        </v-list-item>
                      </v-list>
                    </template>
                  </draggable>
                  <div v-else class="text-body-2 text-medium-emphasis mt-3">
                    No sub-components added yet.
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel class="sub-components-panel">
                <v-expansion-panel-title>
                  <div class="d-flex align-center ga-2">
                    <span>Parent Assemblies</span>
                    <span v-if="parentComponentItems.length" class="expansion-count-badge">
                      {{ parentComponentItems.length }}
                    </span>
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
                          <v-chip
                            class="parent-component-qty"
                            color="primary"
                            size="small"
                            variant="tonal"
                          >
                            Uses {{ parentItem.qty }}
                          </v-chip>
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
                          @part-updated="applyFetchedPart"
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
            <v-col cols="4"> <PartLocationSelect v-model="part.location" /> </v-col>
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
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import draggable from 'vuedraggable';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CustomerSelect from '@/components/CustomerSelect.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import LeaveUnsavedChangesDialog from '@/components/LeaveUnsavedChangesDialog.vue';
import MissingImage from '@/components/MissingImage.vue';
import PartCostDetails from '@/components/parts/PartCostDetails.vue';
import PartDocumentsDetails from '@/components/parts/PartDocumentsDetails.vue';
import PartFilesFolderCard from '@/components/parts/PartFilesFolderCard.vue';
import PartImagesDetails from '@/components/parts/PartImagesDetails.vue';
import PartLocationSelect from '@/components/parts/PartLocationSelect.vue';
import PartMaterialDetails from '@/components/parts/PartMaterialDetails.vue';
import PartNotesDetails from '@/components/parts/PartNotesDetails.vue';
import PartStockGraph from '@/components/parts/PartStockGraph.vue';
import PartsAdjustStockDialog from '@/components/parts/PartsAdjustStockDialog.vue';
import axios from '@/plugins/axios';
import printer from '@/plugins/printer';
import { getToneForRate } from '@/plugins/rates_theme';
import {
  calculateAssemblyCycleMinutes,
  calculatePartShopRate,
  formatCost,
  isNumber,
  onlyAllowNumeric,
} from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import router from '@/router';
import { deviceState } from '@/state/device';
import { useFolderHelperState } from '@/state/folderHelper';
import { useCustomerStore } from '@/stores/customer_store';
import { useMaterialsStore } from '@/stores/materials_store';
import { usePartStore } from '@/stores/parts_store';

const customerStore = useCustomerStore();
const materialsStore = useMaterialsStore();
const partStore = usePartStore();
const { helperStatus, loadFolderHelperManifest, normalizeFolderPath, openFolderWithHelper } =
  useFolderHelperState();

const showAdd = computed(() => {
  return false;
});

const showNeedsReviewControl = computed(() => Boolean(deviceState.current?.isAdmin));

const defaultPartValues: Pick<
  PartFields,
  | 'stock'
  | 'materialLength'
  | 'barLength'
  | 'remnantLength'
  | 'cycleTimes'
  | 'additionalCosts'
  | 'price'
  | 'needsReview'
  | 'customerSuppliedMaterial'
  | 'materialCutType'
> = {
  stock: 0,
  materialLength: 0,
  barLength: 0,
  remnantLength: 0,
  cycleTimes: [],
  additionalCosts: [],
  price: 0,
  needsReview: true,
  customerSuppliedMaterial: false,
  materialCutType: 'blanks',
};

const part = ref<Part>({} as Part);
const partOriginal = ref<Part>({} as Part);
const searchedPartDetails = ref<Part[]>([]);
const relatedSubComponents = ref<PartRelationItem[]>([]);
const relatedParentAssemblies = ref<PartRelationItem[]>([]);

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
const leaveDialogVisible = ref(false);
const pendingNavigationTarget = ref<string | null>(null);
const skipUnsavedChangesGuard = ref(false);
const subComponentSearchSelection = ref<string | null>(null);
const subComponentSearchTerm = ref('');
const subComponentSearchLoading = ref(false);
const subComponentSearchResults = ref<PartSearchItem[]>([]);
const subComponentSearchRequestId = ref(0);
let subComponentSearchTimeout: ReturnType<typeof setTimeout> | null = null;
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
const draggableSubComponentEntries = computed<PartSubComponent[]>({
  get() {
    return part.value.subComponentIds || [];
  },
  set(entries) {
    part.value.subComponentIds = entries.map((entry) => ({
      partId: String(entry.partId),
      qty: Math.max(1, Number(entry.qty) || 1),
    }));
  },
});
const searchedPartsById = computed(() => {
  return new Map(
    subComponentSearchResults.value.map((item) => [
      item._id,
      {
        _id: item._id,
        part: item.part,
        description: item.description,
      },
    ]),
  );
});
const searchableParts = computed(() => {
  return [
    ...partStore.parts,
    ...searchedPartDetails.value,
    ...relatedSubComponents.value.map((item) => item.part),
    ...relatedParentAssemblies.value.map((item) => item.part),
  ];
});
const partById = computed(() => {
  const entries: Part[] = [...searchableParts.value];

  if (part.value._id) entries.push(part.value);

  return new Map(entries.map((candidate) => [candidate._id, candidate]));
});
const resolvePart = (partId: string) => partById.value.get(partId);
const resolveSearchPart = (partId: string) => searchedPartsById.value.get(partId);
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
    searchableParts.value
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
function resolveSubComponentItem(entry: PartSubComponent) {
  const subPart = resolvePart(String(entry.partId));
  if (!subPart || subPart._id === part.value._id) return null;

  return {
    key: String(entry.partId),
    entry,
    part: subPart,
  };
}
const parentComponentItems = computed(() => {
  if (!part.value._id) return [];

  return relatedParentAssemblies.value
    .filter((item) => item.part._id !== part.value._id)
    .map((item) => ({
      part: item.part,
      qty: Math.max(1, Number(item.qty) || 1),
    }))
    .sort((a, b) => a.part.part.localeCompare(b.part.part));
});
const subComponentOptions = computed(() => {
  const selectedIds = new Set(selectedSubComponentIds.value);

  return subComponentSearchResults.value
    .filter((candidate) => !disallowedSubComponentIds.value.has(candidate._id))
    .filter((candidate) => !selectedIds.has(candidate._id))
    .filter((candidate) => candidate._id !== part.value._id)
    .slice()
    .sort((a, b) => a.part.localeCompare(b.part))
    .map((candidate) => ({
      label: `${candidate.part} - ${candidate.description}`,
      value: candidate._id,
    }));
});

const effectiveTotalCycleMinutes = computed(() => {
  if (resolvedSubComponentItems.value.length) {
    return resolvedSubComponentItems.value.reduce((total, subComponent) => {
      return (
        total +
        calculateAssemblyCycleMinutes(subComponent.part, resolvePart) *
          Math.max(1, Number(subComponent.entry.qty) || 1)
      );
    }, 0);
  }

  return calculateAssemblyCycleMinutes(part.value, resolvePart);
});

const totalAdditionalCost = computed(() => {
  return (part.value.additionalCosts || []).reduce(
    (sum, item) => sum + (Number(item.cost) || 0),
    0,
  );
});

const currentRate = computed(() => {
  if (hasNoProductPrice.value) return 0;
  const rate = calculatePartShopRate(
    part.value.price,
    partMaterialCost.value + totalAdditionalCost.value,
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

  if (!partStore.parts.length && !partStore.loading) {
    // partStore.fetch();
  }

  if (routeName === 'createPart') {
    part.value = cloneDeep({ ...part.value, ...defaultPartValues });
    partOriginal.value = cloneDeep({ ...partOriginal.value, ...defaultPartValues });
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

watch(subComponentSearchSelection, async (partId) => {
  if (!partId) return;
  await ensureSearchedPartDetailLoaded(partId);
  if (!selectedSubComponentIds.value.includes(partId)) {
    selectedSubComponentIds.value = [...selectedSubComponentIds.value, partId];
  }
  subComponentSearchSelection.value = null;
  subComponentSearchTerm.value = '';
});

watch(subComponentSearchTerm, (value) => {
  if (subComponentSearchTimeout) clearTimeout(subComponentSearchTimeout);

  const trimmedValue = value.trim();
  if (trimmedValue.length < 3) {
    subComponentSearchLoading.value = false;
    subComponentSearchResults.value = [];
    return;
  }

  subComponentSearchTimeout = setTimeout(() => {
    void loadSubComponentSearchResults(trimmedValue);
  }, 200);
});

onBeforeUnmount(() => {
  // Store the part we were viewing to slightly highlight the row in the part list
  if (subComponentSearchTimeout) clearTimeout(subComponentSearchTimeout);
  partStore.setLastId(part.value._id);
});

watch(
  () => partStore.trigger.partID,
  (partId) => {
    if (router.currentRoute.value.name !== 'viewPart') return;
    if (!partId || partId !== router.currentRoute.value.params.id) return;

    if (partIsAltered.value && saveFlag.value === false) {
      alert('Part was updated. Local changes will be lost.');
    }

    fetchPart(false);
  },
);

function fetchPart(showSpinner: boolean = true) {
  const { id } = router.currentRoute.value.params;
  if (showSpinner) loading.value = true;
  Promise.all([
    axios.get<Part>(`/parts/${id}`),
    axios.get<PartRelationsResponse>(`/parts/${id}/relations`),
  ])
    .then(([partResponse, relationsResponse]) => {
      applyFetchedPart(partResponse.data, relationsResponse.data);
    })
    .catch(() => {
      alert('Part not found.');
    })
    .finally(() => {
      loading.value = false;
    });
}

function applyFetchedPart(source: Part, relations?: PartRelationsResponse) {
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
  relatedSubComponents.value = relations?.subComponents || [];
  relatedParentAssemblies.value = relations?.parents || [];
  part.value = cloneDeep(mergedPart);
  partOriginal.value = cloneDeep(mergedPart);
  void loadCriticalNotesCount();
}

async function loadSubComponentSearchResults(search: string) {
  const requestId = ++subComponentSearchRequestId.value;
  subComponentSearchLoading.value = true;

  try {
    const { data } = await axios.get<PartSearchResponse>('/parts/search', {
      params: {
        search,
        limit: 20,
      },
    });

    if (requestId !== subComponentSearchRequestId.value) return;
    subComponentSearchResults.value = data.items;
  } catch {
    if (requestId !== subComponentSearchRequestId.value) return;
    subComponentSearchResults.value = [];
  } finally {
    if (requestId === subComponentSearchRequestId.value) {
      subComponentSearchLoading.value = false;
    }
  }
}

async function ensureSearchedPartDetailLoaded(partId: string) {
  if (resolvePart(partId)) return;

  const { data } = await axios.get<Part>(`/parts/${partId}`);
  searchedPartDetails.value = [
    ...searchedPartDetails.value.filter((candidate) => candidate._id !== data._id),
    data,
  ];
}

async function savePart() {
  const saved = await persistPart();
  if (!saved) return;

  skipUnsavedChangesGuard.value = true;
  router.back();
}

async function persistPart() {
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
        partOriginal.value = cloneDeep(part.value);
        toastSuccess('Part added successfully');
      })
      .catch(() => {
        toastError('Unable to add part');
      });
  } else if (routeName === 'viewPart') {
    await partStore
      .update(part.value)
      .then(() => {
        partOriginal.value = cloneDeep(part.value);
        toastSuccess('Part updated successfully');
      })
      .catch(() => {
        toastError('Unable to update part');
      });
  }
  saveFlag.value = false;
  return true;
}

async function saveAndContinue() {
  const target = pendingNavigationTarget.value;
  if (!target) return;

  const saved = await persistPart();
  if (!saved) return;

  leaveDialogVisible.value = false;
  pendingNavigationTarget.value = null;
  skipUnsavedChangesGuard.value = true;
  await router.push(target);
}

async function leaveWithoutSaving() {
  const target = pendingNavigationTarget.value;
  if (!target) return;

  leaveDialogVisible.value = false;
  pendingNavigationTarget.value = null;
  skipUnsavedChangesGuard.value = true;
  await router.push(target);
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
    subComponentIds: (value.subComponentIds || []).map((subComponent) => ({
      partId: String(subComponent.partId),
      qty: Math.max(1, Number(subComponent.qty) || 1),
    })),
  };
}

const comparableFieldLabels = {
  part: 'Part Number',
  revision: 'Revision',
  customer: 'Customer',
  description: 'Description',
  productLink: 'Web URL',
  material: 'Material',
  customerSuppliedMaterial: 'Customer Supplied Material',
  materialCutType: 'Cut Type',
  materialLength: 'Material Length',
  barLength: 'Bar Length',
  remnantLength: 'Remnant Length',
  cycleTimes: 'Cycle Times',
  additionalCosts: 'Additional Costs',
  price: 'Price',
  stock: 'Stock Qty',
  location: 'Location',
  position: 'Position',
  subComponentIds: 'Sub-Components',
} satisfies Partial<Record<keyof ReturnType<typeof toComparablePart>, string>>;

const comparablePart = computed(() => toComparablePart(part.value));
const comparableOriginalPart = computed(() => toComparablePart(partOriginal.value));

const partIsAltered = computed<boolean>(() => {
  return !isEqual(comparablePart.value, comparableOriginalPart.value);
});

const REQUIRED_MESSAGE = 'Required';

function formatComparableEntityName(
  value:
    | { _id: string; name?: string; description?: string; customer?: string }
    | string
    | undefined,
) {
  if (!value) return 'Empty';
  if (typeof value === 'string') {
    const customer = customerStore.customers.find((candidate) => candidate._id === value);
    if (customer) return customer.name;

    const material = materialsStore.materials.find((candidate) => candidate._id === value);
    if (material) return material.description;

    return value;
  }
  return value.name || value.description || value.customer || value._id;
}

function formatChangedPartFieldValue(
  key: keyof ReturnType<typeof toComparablePart>,
  value: unknown,
  rawValue: unknown,
) {
  if (value == null || value === '') return 'Empty';
  if (key === 'customer' || key === 'material') {
    return formatComparableEntityName(
      rawValue as
        | { _id: string; name?: string; description?: string; customer?: string }
        | string
        | undefined,
    );
  }
  if (key === 'price') {
    return `$${formatCost(typeof value === 'number' ? value : Number(value))}`;
  }
  if (key === 'subComponentIds') {
    const subComponents = rawValue as PartSubComponent[] | undefined;
    const labels = (subComponents || [])
      .map((subComponent) => resolvePart(String(subComponent.partId))?.part)
      .filter((label): label is string => Boolean(label));

    if (!labels.length) return `${subComponents?.length || 0} selected`;

    return labels.slice(0, 3).join(', ') + (labels.length > 3 ? ` +${labels.length - 3} more` : '');
  }
  if (key === 'cycleTimes') {
    const cycleTimes = rawValue as unknown[] | undefined;
    return `${cycleTimes?.length || 0} entries`;
  }
  if (key === 'additionalCosts') {
    const additionalCosts = rawValue as unknown[] | undefined;
    return `${additionalCosts?.length || 0} entries`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function getPartFieldsBlockingSave() {
  const blocked = new Map<keyof ReturnType<typeof toComparablePart>, string>();

  if (!part.value.part?.trim()) blocked.set('part', REQUIRED_MESSAGE);
  if (!part.value.description?.trim()) blocked.set('description', REQUIRED_MESSAGE);
  if (!part.value.customer) blocked.set('customer', REQUIRED_MESSAGE);

  return blocked;
}

function getChangedPartFields() {
  const blockedFields = getPartFieldsBlockingSave();

  return Object.entries(comparableFieldLabels)
    .filter(([key]) => {
      const fieldKey = key as keyof ReturnType<typeof toComparablePart>;
      return !isEqual(comparablePart.value[fieldKey], comparableOriginalPart.value[fieldKey]);
    })
    .map(([key, label]) => {
      const fieldKey = key as keyof ReturnType<typeof toComparablePart>;
      return {
        label,
        blockReason: blockedFields.get(fieldKey),
        value: formatChangedPartFieldValue(
          fieldKey,
          comparablePart.value[fieldKey],
          part.value[fieldKey],
        ),
      };
    });
}

const changedPartFields = computed<Array<{ label: string; value: string; blockReason?: string }>>(
  () => getChangedPartFields(),
);

const canSavePart = computed<boolean>(() => partIsAltered.value && valid.value);

const requiredRule = (val: string) => !!val || REQUIRED_MESSAGE;

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

function shouldBlockNavigation(to: { name?: unknown; params: Record<string, unknown> }) {
  if (skipUnsavedChangesGuard.value) {
    skipUnsavedChangesGuard.value = false;
    return false;
  }

  if (!partIsAltered.value) return false;

  const currentRoute = router.currentRoute.value;
  const currentId = String(currentRoute.params.id ?? '');
  const nextId = String(to.params.id ?? '');

  return to.name !== currentRoute.name || nextId !== currentId;
}

function queuePendingNavigation(target: string) {
  pendingNavigationTarget.value = target;
  leaveDialogVisible.value = true;
}

onBeforeRouteLeave((to) => {
  if (!shouldBlockNavigation(to)) return true;

  queuePendingNavigation(to.fullPath);
  return false;
});

onBeforeRouteUpdate((to) => {
  if (!shouldBlockNavigation(to)) return true;

  queuePendingNavigation(to.fullPath);
  return false;
});

function syncPersistedPartImages() {
  const partId = part.value._id;
  if (!partId) return;

  const imageIds = partStore.getPartImages(partId).map((image) => image.id);
  part.value.imageIds = imageIds;
  partOriginal.value.imageIds = [...imageIds];
}

function onPartImageSelected(payload: { imageId: string; url: string; isMain?: boolean }) {
  if (!payload.isMain) return;

  part.value.img = payload.url;
  partOriginal.value.img = payload.url;
  if (part.value._id) {
    partStore.updatePartImage(part.value._id, payload.url);
    syncPersistedPartImages();
  }
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

.expansion-count-badge {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, rgb(var(--v-theme-success)) 22%, white);
  color: rgb(var(--v-theme-success));
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1;
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

.sub-component-draggable-list {
  padding: 0;
}

.sub-component-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.55;
}

.sub-component-row--dragging {
  opacity: 0.9;
}

.sub-component-row--ghost {
  opacity: 0.45;
}

.sub-component-qty-field {
  width: 88px;
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
