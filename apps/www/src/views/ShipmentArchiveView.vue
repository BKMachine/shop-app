<template>
  <v-card class="infinite-scroll-view-card">
    <v-card-title class="header mt-4">
      <div class="d-flex flex-column">
        <span>Shipment Archive</span>
        <span class="text-title-small text-medium-emphasis">{{ shipmentCountLabel }}</span>
      </div>

      <div class="header-actions">
        <v-btn color="primary" prepend-icon="mdi-truck-check-outline" @click="openCreateDialog">
          New Shipment
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text class="shipment-archive infinite-scroll-view-card__body">
      <div class="shipment-filters mt-2">
        <v-text-field
          v-model="filters.search"
          clearable
          label="Search"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          @click:clear="applyFilters"
          @keyup.enter="applyFilters"
        >
          <template #details>
            <div class="search-details">
              <button class="clear-filters-hint" type="button" @click="clearFilters">
                Clear all filters
              </button>
            </div>
          </template>
        </v-text-field>
        <v-text-field
          v-model="filters.from"
          hide-details
          label="From"
          type="date"
          variant="outlined"
        />
        <v-text-field v-model="filters.to" hide-details label="To" type="date" variant="outlined" />
        <CustomerSelect v-model="filters.customer" label="Customer" variant="outlined" />
      </div>

      <div v-if="shipmentStore.loading && !shipmentStore.shipments.length" class="loading-block">
        <v-progress-circular indeterminate />
      </div>

      <v-alert
        v-else-if="!shipmentStore.shipments.length"
        class="shipment-empty-alert"
        density="compact"
        type="info"
        variant="tonal"
      >
        No shipment photos archived yet.
      </v-alert>

      <div v-else class="shipment-batches">
        <section v-for="group in groupedShipments" :key="group.key" class="shipment-batch">
          <div class="shipment-batch__header">
            <h2 class="text-subtitle-1">{{ group.label }}</h2>
            <span class="text-caption text-medium-emphasis"
              >{{ group.items.length }}
              shipment(s)</span
            >
          </div>

          <div class="shipment-list">
            <button
              v-for="shipment in group.items"
              :key="shipment._id"
              class="shipment-row"
              type="button"
              @click="openDetails(shipment)"
            >
              <div class="shipment-row__thumbs">
                <template v-if="previewImages(shipment).length">
                  <img
                    v-for="image in previewImages(shipment).slice(0, 4)"
                    :key="image.id"
                    alt=""
                    class="shipment-row__thumb"
                    :src="image.url"
                  />
                </template>
                <div v-else class="shipment-row__empty-thumb">
                  <v-icon icon="mdi-image-multiple-outline" />
                </div>
              </div>

              <div class="shipment-row__body">
                <div class="shipment-row__title">{{ shipmentTitle(shipment) }}</div>
                <div class="shipment-row__meta">
                  <span>{{ formatShipmentTime(shipment.shippedAt) }}</span>
                  <span v-if="customerName(shipment)">{{ customerName(shipment) }}</span>
                  <span v-if="shipperName(shipment)">{{ shipperName(shipment) }}</span>
                  <span
                    v-for="trackingNumber in trackingNumbersForShipment(shipment)"
                    :key="`${shipment._id}-${trackingNumber}`"
                    :class="{ 'shipment-tracking-link': trackingUrlForCarrier(shipperName(shipment), trackingNumber) }"
                    @click.stop="openTrackingLink(shipperName(shipment), trackingNumber)"
                  >
                    {{ trackingNumber }}
                  </span>
                </div>
              </div>

              <div class="shipment-row__count">
                <v-icon icon="mdi-image-outline" size="18" />
                {{ imageCount(shipment) }}
              </div>
            </button>
          </div>
        </section>
      </div>

      <div v-if="shipmentStore.hasMore" class="load-more-row">
        <v-btn
          :loading="shipmentStore.loading"
          prepend-icon="mdi-chevron-down"
          variant="outlined"
          @click="loadMore"
        >
          Load More
        </v-btn>
      </div>
    </v-card-text>

    <v-dialog v-model="createDialog" max-width="980" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          New Shipment
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="createDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-row class="create-shipment-fields" no-gutters>
            <v-col cols="12" md="4">
              <v-text-field v-model="draftShippedDate" label="Shipment Date" required type="date" />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field v-model="draftShippedTime" label="Time" required type="time" />
            </v-col>
            <v-col cols="12" md="6">
              <CustomerSelect v-model="draft.customer" label="Customer" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="draft.orderNumber" label="Order Number" />
            </v-col>
            <v-col cols="12" md="6">
              <ShipperSelect
                v-model="draft.shipper"
                :error="draftCarrierBlurred && Boolean(draftCarrierValidationMessage)"
                :error-messages="draftCarrierBlurred ? draftCarrierValidationMessage : ''"
                label="Carrier"
                required
                @blur="draftCarrierBlurred = true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-textarea
                v-model="draft.trackingNumber"
                auto-grow
                :error="draftTrackingBlurred && Boolean(draftTrackingValidationMessage)"
                :hint="draftTrackingBlurred ? draftTrackingValidationMessage : ''"
                label="Tracking Numbers"
                :persistent-hint="draftTrackingBlurred && Boolean(draftTrackingValidationMessage)"
                rows="2"
                @blur="draftTrackingBlurred = true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-textarea v-model="draft.notes" auto-grow label="Notes" rows="2" />
            </v-col>
          </v-row>

          <div class="temp-gallery-header">
            <div>
              <h3 class="text-subtitle-1">Temp Images</h3>
              <p class="text-body-2 text-medium-emphasis">
                Selected images become the shipment photo set.
              </p>
            </div>
            <v-btn
              :loading="loadingTempImages"
              prepend-icon="mdi-refresh"
              size="small"
              variant="text"
              @click="loadTempImages"
            >
              Refresh
            </v-btn>
          </div>

          <div v-if="loadingTempImages" class="loading-block loading-block--small">
            <v-progress-circular indeterminate />
          </div>
          <v-alert v-else-if="!tempImages.length" type="info" variant="tonal">
            No temp images available. Upload from Android first, then refresh this dialog.
          </v-alert>
          <v-row v-else dense>
            <v-col v-for="image in tempImages" :key="image.id" cols="6" lg="2" md="3" sm="4">
              <v-card
                :border="selectedTempImageIds.includes(image.id)"
                class="temp-image-card"
                :color="selectedTempImageIds.includes(image.id) ? 'primary' : undefined"
                hover
                @click="toggleTempImage(image.id)"
              >
                <v-img aspect-ratio="1" class="temp-image-card__img" cover :src="image.url" />
                <v-card-subtitle class="text-caption text-truncate pa-2">
                  {{ formatShortDate(image.createdAt) }}
                </v-card-subtitle>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <div class="text-body-2 text-medium-emphasis">
            {{ selectedTempImageIds.length }}
            selected
          </div>
          <v-spacer />
          <v-btn variant="text" @click="createDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!draft.shippedAt || savingShipment"
            :loading="savingShipment"
            @click="saveShipment"
          >
            Save Shipment
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailsDialogModel" fullscreen>
      <v-card v-if="selectedShipment" class="details-dialog">
        <v-toolbar density="comfortable">
          <v-toolbar-title>{{ shipmentTitle(selectedShipment) }}</v-toolbar-title>
          <v-spacer />
          <v-btn
            icon="mdi-image-plus-outline"
            title="Add Images"
            variant="text"
            @click="addImagesDialog = true"
          />
          <v-btn
            :disabled="isSelectedShipmentOcrBusy"
            icon="mdi-delete-outline"
            title="Delete Shipment"
            variant="text"
            @click="confirmDeleteShipment"
          />
          <v-btn icon="mdi-close" variant="text" @click="requestCloseDetailsDialog" />
        </v-toolbar>

        <v-card-text>
          <div class="details-layout">
            <aside class="details-panel">
              <v-text-field
                v-model="detailDraft.shippedAt"
                label="Shipment Date"
                readonly
                type="datetime-local"
              />
              <CustomerSelect v-model="detailDraft.customer" label="Customer" />
              <v-text-field v-model="detailDraft.orderNumber" label="Order Number" />
              <ShipperSelect
                v-model="detailDraft.shipper"
                :error="detailCarrierBlurred && Boolean(detailCarrierValidationMessage)"
                :error-messages="detailCarrierBlurred ? detailCarrierValidationMessage : ''"
                label="Carrier"
                required
                @blur="detailCarrierBlurred = true"
              />
              <v-textarea
                v-model="detailDraft.trackingNumber"
                auto-grow
                :error="detailTrackingBlurred && Boolean(detailTrackingValidationMessage)"
                :hint="detailTrackingBlurred ? detailTrackingValidationMessage : ''"
                label="Tracking Numbers"
                :persistent-hint="detailTrackingBlurred && Boolean(detailTrackingValidationMessage)"
                rows="2"
                @blur="detailTrackingBlurred = true"
              />

              <v-textarea
                v-model="detailDraft.notes"
                auto-grow
                density="compact"
                label="Notes"
                rows="3"
              />
              <v-btn
                block
                color="success"
                :disabled="!hasDetailChanges || savingDetails"
                :loading="savingDetails"
                prepend-icon="mdi-content-save-outline"
                @click="saveDetails"
              >
                Save Details
              </v-btn>
            </aside>

            <main class="details-gallery">
              <div v-if="loadingShipmentImages" class="loading-block">
                <v-progress-circular indeterminate />
              </div>
              <v-alert v-else-if="!selectedImages.length" type="info" variant="tonal">
                No images are attached to this shipment.
              </v-alert>
              <div v-else class="details-image-grid">
                <v-card
                  v-for="(image, index) in selectedImages"
                  :key="imageCardKey(image.id, index)"
                  class="details-image-card"
                >
                  <button
                    class="details-image-card__preview"
                    type="button"
                    @click="openGallery(index)"
                  >
                    <v-img
                      aspect-ratio="1"
                      class="details-image-card__img"
                      contain
                      :src="image.url"
                    />
                  </button>

                  <div class="details-image-card__footer">
                    <div class="details-image-card__actions mt-2">
                      <v-btn
                        color="primary"
                        :disabled="isImageOcrBusy(image.id)"
                        icon="mdi-text-recognition"
                        :loading="ocrImageId === image.id"
                        size="x-small"
                        :title="isImageOcrQueued(image.id) ? 'OCR queued' : 'Run OCR'"
                        variant="text"
                        @click.stop="runImageOcr(image.id)"
                      />
                      <v-btn
                        v-if="showDevTools"
                        color="secondary"
                        icon="mdi-image-search-outline"
                        :loading="ocrDebugImageId === image.id"
                        size="x-small"
                        title="Open OCR Debug Overlay"
                        variant="text"
                        @click.stop="openImageOcrDebug(image.id)"
                      />
                      <v-btn
                        color="error"
                        :disabled="isImageOcrBusy(image.id)"
                        icon="mdi-delete"
                        :loading="deletingImageId === image.id"
                        size="x-small"
                        :title="
                          isImageOcrBusy(image.id)
                            ? 'OCR is queued for this image'
                            : 'Delete image'
                        "
                        variant="text"
                        @click.stop="confirmDeleteImage(image)"
                      />
                    </div>
                  </div>
                  <div class="details-image-card__ocr" @click.stop>
                    <v-btn
                      class="details-image-card__ocr-toggle"
                      :class="{
                        'details-image-card__ocr-toggle--expanded': isOcrExpanded(image.id, index),
                      }"
                      density="compact"
                      :icon="
                        isOcrExpanded(image.id, index) ? 'mdi-chevron-up' : 'mdi-chevron-down'
                      "
                      size="x-small"
                      :title="
                        isOcrExpanded(image.id, index) ? 'Hide OCR text' : 'Show OCR text'
                      "
                      variant="text"
                      @click.stop="toggleOcrExpanded(image.id, index)"
                    />
                    <transition name="ocr-expand">
                      <div
                        v-if="isOcrExpanded(image.id, index)"
                        class="details-image-card__ocr-body"
                      >
                        <div v-if="image.ocrText" class="details-image-card__ocr-text">
                          {{ image.ocrText }}
                        </div>
                        <div v-else class="text-body-2 text-medium-emphasis">
                          No readable text was detected for this image.
                        </div>
                      </div>
                    </transition>
                  </div>
                </v-card>
              </div>
            </main>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="galleryOpen" content-class="gallery-overlay" fullscreen>
      <v-card class="gallery-dialog">
        <v-toolbar color="black" density="comfortable" theme="dark">
          <v-toolbar-title>{{ galleryTitle }}</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="galleryOpen = false" />
        </v-toolbar>

        <v-card-text class="gallery-content pa-0">
          <div class="gallery-stage">
            <button
              v-if="selectedImages.length > 1"
              aria-label="Previous image"
              class="gallery-nav gallery-nav--prev"
              type="button"
              @click="showPreviousImage"
            >
              <v-icon icon="mdi-chevron-left" />
            </button>

            <div class="gallery-slide">
              <img
                v-if="selectedImages[galleryIndex]"
                alt=""
                class="gallery-image"
                :src="selectedImages[galleryIndex]?.url"
              />
            </div>

            <button
              v-if="selectedImages.length > 1"
              aria-label="Next image"
              class="gallery-nav gallery-nav--next"
              type="button"
              @click="showNextImage"
            >
              <v-icon icon="mdi-chevron-right" />
            </button>
          </div>

          <div v-if="selectedImages.length > 1" class="gallery-pagination">
            <button
              v-for="(_, index) in selectedImages"
              :key="`shipment-gallery-dot-${index}`"
              class="gallery-pagination__dot"
              :class="{ 'gallery-pagination__dot--active': index === galleryIndex }"
              type="button"
              @click="galleryIndex = index"
            />
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <ImageManagerDialog
      v-if="selectedShipment"
      v-model="addImagesDialog"
      :entity-id="selectedShipment._id"
      entity-type="shipment"
      :has-image="selectedImages.length > 0"
      :title="shipmentTitle(selectedShipment)"
      @images-selected="handleShipmentImagesSelected"
    />

    <ConfirmDialog
      v-model="deleteImageConfirm"
      confirm-text="Delete"
      :loading="Boolean(deleteImageTarget && deletingImageId === deleteImageTarget.id)"
      title="Delete Shipment Image?"
      @confirm="deleteConfirmedImage"
    >
      This will permanently remove the image from this shipment.
    </ConfirmDialog>

    <ConfirmDialog
      v-model="deleteShipmentConfirm"
      confirm-text="Delete"
      :loading="deletingShipment"
      title="Delete Shipment?"
      @confirm="deleteSelectedShipment"
    >
      This permanently removes the shipment and all attached shipment images.
    </ConfirmDialog>

    <ConfirmDialog
      v-model="discardDetailsConfirm"
      confirm-text="Discard Changes"
      title="Discard Unsaved Changes?"
      @confirm="discardDetailChangesAndClose"
    >
      You have unsaved shipment detail changes. Closing now will discard them.
    </ConfirmDialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CustomerSelect from '@/components/CustomerSelect.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import ShipperSelect from '@/components/ShipperSelect.vue';
import api from '@/plugins/axios';
import { toastError } from '@/plugins/vue-toast-notification';
import { useShipmentsStore } from '@/stores/shipments_store';
import { useShipperStore } from '@/stores/shipper_store';

type TempImage = MyImageData & { status?: 'temp' };
type ShipmentOcrJob = {
  shipmentId: string;
  imageId: string;
};

type ShipmentDraft = ReturnType<typeof createEmptyDraft>;

const shipmentStore = useShipmentsStore();
const shipperStore = useShipperStore();
const todayFilterValue = new Date().toLocaleDateString('en-CA');

function createDefaultFilters() {
  return {
    search: '',
    from: '',
    to: todayFilterValue,
    customer: null as string | null,
  };
}

const filters = ref(createDefaultFilters());

const createDialog = ref(false);
const detailsDialog = ref(false);
const addImagesDialog = ref(false);
const deleteImageConfirm = ref(false);
const deleteShipmentConfirm = ref(false);
const discardDetailsConfirm = ref(false);
const savingShipment = ref(false);
const savingDetails = ref(false);
const deletingShipment = ref(false);
const loadingTempImages = ref(false);
const loadingShipmentImages = ref(false);
const deletingImageId = ref('');
const ocrImageId = ref('');
const ocrDebugImageId = ref('');
const expandedOcrImageIds = ref<string[]>([]);
const queuedOcrJobs = ref<ShipmentOcrJob[]>([]);
const processingOcrQueue = ref(false);
const galleryOpen = ref(false);
const galleryIndex = ref(0);
const selectedShipment = ref<Shipment | null>(null);
const deleteImageTarget = ref<MyImageData | null>(null);
const tempImages = ref<TempImage[]>([]);
const selectedTempImageIds = ref<string[]>([]);
const draftCarrierBlurred = ref(false);
const detailCarrierBlurred = ref(false);
const draftTrackingBlurred = ref(false);
const detailTrackingBlurred = ref(false);
const detailTrackingEditing = ref(false);
const detailTrackingTextarea = ref<{ focus?: () => void } | null>(null);
let searchDebounceId: ReturnType<typeof setTimeout> | null = null;

const draft = ref(createEmptyDraft());
const detailDraft = ref(createEmptyDraft());

const draftShippedDate = computed({
  get: () => splitDatetimeLocal(draft.value.shippedAt).date,
  set: (date: string) => {
    const current = splitDatetimeLocal(draft.value.shippedAt);
    draft.value.shippedAt = joinDatetimeLocal(date, current.time);
  },
});

const draftShippedTime = computed({
  get: () => splitDatetimeLocal(draft.value.shippedAt).time,
  set: (time: string) => {
    const current = splitDatetimeLocal(draft.value.shippedAt);
    draft.value.shippedAt = joinDatetimeLocal(current.date, time);
  },
});

const selectedImages = computed(() => {
  if (!selectedShipment.value) return [];
  return shipmentStore.getImages(selectedShipment.value._id);
});

const galleryTitle = computed(() => {
  if (!selectedImages.value.length) return 'Shipment Gallery';
  return `Image ${galleryIndex.value + 1} of ${selectedImages.value.length}`;
});

const shipmentCountLabel = computed(() => {
  const count = shipmentStore.total;
  if (count === 1) return '1 shipment';
  return `${count} shipments`;
});

const showDevTools = import.meta.env.DEV;

const isSelectedShipmentOcrBusy = computed(() => {
  if (!selectedShipment.value) return false;

  const selectedShipmentId = selectedShipment.value._id;
  if (queuedOcrJobs.value.some((job) => job.shipmentId === selectedShipmentId)) {
    return true;
  }

  if (!ocrImageId.value) return false;
  return selectedImages.value.some((image) => image.id === ocrImageId.value);
});

const hasDetailChanges = computed(() => {
  if (!selectedShipment.value) return false;

  const currentDraft = JSON.stringify(detailDraft.value);
  const originalDraft = JSON.stringify(shipmentToDraft(selectedShipment.value));
  return currentDraft !== originalDraft;
});

const draftCarrierValidationMessage = computed(() => carrierValidationMessageForDraft(draft.value));
const detailCarrierValidationMessage = computed(() =>
  carrierValidationMessageForDraft(detailDraft.value),
);
const draftTrackingValidationMessage = computed(() =>
  trackingValidationMessageForDraft(draft.value),
);
const detailTrackingValidationMessage = computed(() =>
  trackingValidationMessageForDraft(detailDraft.value),
);

const detailsDialogModel = computed({
  get: () => detailsDialog.value,
  set: (nextValue: boolean) => {
    if (nextValue) {
      detailsDialog.value = true;
      return;
    }

    requestCloseDetailsDialog();
  },
});

const groupedShipments = computed(() => {
  const groups = new Map<string, { key: string; label: string; items: Shipment[] }>();

  for (const shipment of shipmentStore.shipments) {
    const date = new Date(shipment.shippedAt);
    const key = date.toLocaleDateString('en-CA');
    const label = date.toLocaleDateString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)?.items.push(shipment);
  }

  return [...groups.values()];
});

onMounted(async () => {
  window.addEventListener('keydown', handleGalleryKeydown);
  await applyFilters();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGalleryKeydown);
  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
  }
});

watch(
  () => shipmentStore.shipments.map((shipment) => shipment._id).join(','),
  () => {
    for (const shipment of shipmentStore.shipments.slice(0, 30)) {
      if (!shipmentStore.getImages(shipment._id).length && shipment.imageIds?.length) {
        void shipmentStore.loadImages(shipment._id);
      }
    }
  },
  { immediate: true },
);

watch(galleryOpen, (isOpen) => {
  if (!isOpen) {
    galleryIndex.value = 0;
  }
});

watch(
  () => filters.value.search,
  () => {
    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
    }

    searchDebounceId = setTimeout(() => {
      void applyFilters();
    }, 250);
  },
);

watch(
  () => filters.value.customer,
  () => {
    void applyFilters();
  },
);

watch(
  () => filters.value.from,
  () => {
    void applyFilters();
  },
);

watch(
  () => filters.value.to,
  () => {
    void applyFilters();
  },
);

function createEmptyDraft() {
  return {
    shippedAt: toDatetimeLocal(new Date()),
    customer: null as string | null,
    shipper: null as string | null,
    orderNumber: '',
    trackingNumber: '',
    carrier: '',
    notes: '',
  };
}

async function applyFilters() {
  await shipmentStore.fetch({
    search: filters.value.search || undefined,
    from: filters.value.from ? startOfDayIso(filters.value.from) : undefined,
    to: filters.value.to ? endOfDayIso(filters.value.to) : undefined,
    customer: filters.value.customer || undefined,
  });
}

async function clearFilters() {
  filters.value = createDefaultFilters();
  await applyFilters();
}

async function loadMore() {
  await shipmentStore.fetchNextPage();
}

function openCreateDialog() {
  draft.value = createEmptyDraft();
  draftCarrierBlurred.value = false;
  draftTrackingBlurred.value = false;
  selectedTempImageIds.value = [];
  createDialog.value = true;
  void loadTempImages();
}

async function loadTempImages() {
  loadingTempImages.value = true;
  try {
    const { data } = await api.get<TempImage[]>('/images/uploads/temps');
    tempImages.value = data;
  } finally {
    loadingTempImages.value = false;
  }
}

function toggleTempImage(imageId: string) {
  if (selectedTempImageIds.value.includes(imageId)) {
    selectedTempImageIds.value = selectedTempImageIds.value.filter((id) => id !== imageId);
    return;
  }

  selectedTempImageIds.value.push(imageId);
}

async function saveShipment() {
  draftCarrierBlurred.value = true;
  if (draftCarrierValidationMessage.value) {
    toastError(draftCarrierValidationMessage.value);
    return;
  }

  draftTrackingBlurred.value = true;
  if (draftTrackingValidationMessage.value) {
    toastError(draftTrackingValidationMessage.value);
    return;
  }

  savingShipment.value = true;
  try {
    const shipment = await shipmentStore.create(
      toShipmentCreate(draft.value),
      selectedTempImageIds.value,
    );
    queueShipmentImageOcr(shipment._id, selectedTempImageIds.value);
    createDialog.value = false;
  } finally {
    savingShipment.value = false;
  }
}

async function openDetails(shipment: Shipment) {
  selectedShipment.value = shipment;
  detailDraft.value = shipmentToDraft(shipment);
  detailCarrierBlurred.value = false;
  detailTrackingBlurred.value = false;
  detailTrackingEditing.value = false;
  detailsDialog.value = true;
  await loadSelectedShipmentImages();
}

function requestCloseDetailsDialog() {
  if (savingDetails.value) return;
  if (hasDetailChanges.value) {
    discardDetailsConfirm.value = true;
    return;
  }

  closeDetailsDialog();
}

function discardDetailChangesAndClose() {
  if (selectedShipment.value) {
    detailDraft.value = shipmentToDraft(selectedShipment.value);
  }

  detailTrackingEditing.value = false;
  discardDetailsConfirm.value = false;
  closeDetailsDialog();
}

function closeDetailsDialog() {
  detailsDialog.value = false;
  discardDetailsConfirm.value = false;
  detailTrackingEditing.value = false;
}

async function loadSelectedShipmentImages() {
  if (!selectedShipment.value) return;
  loadingShipmentImages.value = true;
  try {
    await shipmentStore.loadImages(selectedShipment.value._id);
  } finally {
    loadingShipmentImages.value = false;
  }
}

async function handleShipmentImagesSelected(payload: {
  images: { imageId: string; url: string; isMain?: boolean }[];
}) {
  await loadSelectedShipmentImages();
  if (selectedShipment.value) {
    queueShipmentImageOcr(
      selectedShipment.value._id,
      payload.images.map((image) => image.imageId),
    );
  }
}

function isImageOcrQueued(imageId: string) {
  return queuedOcrJobs.value.some((job) => job.imageId === imageId);
}

function isImageOcrBusy(imageId: string) {
  return ocrImageId.value === imageId || isImageOcrQueued(imageId);
}

function queueShipmentImageOcr(shipmentId: string, imageIds: string[]) {
  const nextQueuedJobs = [...queuedOcrJobs.value];
  for (const imageId of imageIds) {
    if (
      !imageId ||
      ocrImageId.value === imageId ||
      nextQueuedJobs.some((job) => job.imageId === imageId)
    ) {
      continue;
    }
    nextQueuedJobs.push({ shipmentId, imageId });
  }

  queuedOcrJobs.value = nextQueuedJobs;
  void processShipmentImageOcrQueue();
}

async function processShipmentImageOcrQueue() {
  if (processingOcrQueue.value) return;

  processingOcrQueue.value = true;
  try {
    while (queuedOcrJobs.value.length) {
      const job = queuedOcrJobs.value[0];
      queuedOcrJobs.value = queuedOcrJobs.value.slice(1);
      if (!job) continue;

      ocrImageId.value = job.imageId;
      try {
        await shipmentStore.rerunImageOcr(job.shipmentId, job.imageId, { silent: true });
      } catch {
        // Store shows the failure toast; continue with the rest of the queue.
      } finally {
        if (ocrImageId.value === job.imageId) ocrImageId.value = '';
      }
    }
  } finally {
    processingOcrQueue.value = false;
  }
}

function openGallery(index: number) {
  galleryIndex.value = index;
  galleryOpen.value = true;
}

function imageCardKey(imageId: string, index: number) {
  return `${selectedShipment.value?._id || 'shipment'}:${imageId}:${index}`;
}

function isOcrExpanded(imageId: string, index: number) {
  return expandedOcrImageIds.value.includes(imageCardKey(imageId, index));
}

function toggleOcrExpanded(imageId: string, index: number) {
  const cardKey = imageCardKey(imageId, index);
  if (expandedOcrImageIds.value.includes(cardKey)) {
    expandedOcrImageIds.value = expandedOcrImageIds.value.filter((id) => id !== cardKey);
    return;
  }

  expandedOcrImageIds.value = [...expandedOcrImageIds.value, cardKey];
}

function showPreviousImage() {
  if (!selectedImages.value.length) return;
  galleryIndex.value =
    galleryIndex.value === 0 ? selectedImages.value.length - 1 : galleryIndex.value - 1;
}

function showNextImage() {
  if (!selectedImages.value.length) return;
  galleryIndex.value =
    galleryIndex.value === selectedImages.value.length - 1 ? 0 : galleryIndex.value + 1;
}

function handleGalleryKeydown(event: KeyboardEvent) {
  if (!galleryOpen.value) return;

  if (event.key === 'Escape') {
    galleryOpen.value = false;
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showPreviousImage();
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showNextImage();
  }
}

async function saveDetails() {
  if (!selectedShipment.value) return;

  detailCarrierBlurred.value = true;
  if (detailCarrierValidationMessage.value) {
    toastError(detailCarrierValidationMessage.value);
    return;
  }

  detailTrackingBlurred.value = true;
  if (detailTrackingValidationMessage.value) {
    toastError(detailTrackingValidationMessage.value);
    return;
  }

  savingDetails.value = true;
  try {
    const updated = await shipmentStore.update({
      ...toShipmentCreate(detailDraft.value),
      _id: selectedShipment.value._id,
      imageIds: selectedImages.value.map((image) => image.id),
    });
    selectedShipment.value = updated;
    detailDraft.value = shipmentToDraft(updated);
    detailTrackingEditing.value = false;
  } finally {
    savingDetails.value = false;
  }
}

async function startDetailTrackingEdit() {
  detailTrackingEditing.value = true;
  await nextTick();
  detailTrackingTextarea.value?.focus?.();
}

function finishDetailTrackingEdit() {
  detailTrackingBlurred.value = true;
  detailTrackingEditing.value = false;
}

function confirmDeleteImage(image: MyImageData) {
  if (isImageOcrBusy(image.id)) {
    toastError('Wait for queued OCR to finish before deleting this image');
    return;
  }

  deleteImageTarget.value = image;
  deleteImageConfirm.value = true;
}

function confirmDeleteShipment() {
  if (isSelectedShipmentOcrBusy.value) {
    toastError('Wait for queued OCR to finish before deleting this shipment');
    return;
  }

  deleteShipmentConfirm.value = true;
}

async function deleteConfirmedImage() {
  if (!selectedShipment.value || !deleteImageTarget.value) return;
  deletingImageId.value = deleteImageTarget.value.id;
  try {
    await shipmentStore.deleteImage(selectedShipment.value._id, deleteImageTarget.value.id);
    deleteImageConfirm.value = false;
    deleteImageTarget.value = null;
  } finally {
    deletingImageId.value = '';
  }
}

async function runImageOcr(imageId: string) {
  if (!selectedShipment.value || !imageId || isImageOcrBusy(imageId)) return;

  ocrImageId.value = imageId;

  try {
    await shipmentStore.rerunImageOcr(selectedShipment.value._id, imageId);
  } finally {
    ocrImageId.value = '';
  }
}

async function openImageOcrDebug(imageId: string) {
  if (!showDevTools || !selectedShipment.value || !imageId || ocrDebugImageId.value) return;

  ocrDebugImageId.value = imageId;

  try {
    const { data } = await api.post<Blob>(
      `/images/entities/shipment/${selectedShipment.value._id}/images/${imageId}/ocr/debug`,
      undefined,
      {
        responseType: 'blob',
      },
    );

    const blobUrl = URL.createObjectURL(data);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60_000);
  } catch (error) {
    toastError('Failed to open OCR debug overlay');
    throw error;
  } finally {
    ocrDebugImageId.value = '';
  }
}

async function deleteSelectedShipment() {
  if (!selectedShipment.value) return;
  if (isSelectedShipmentOcrBusy.value) {
    toastError('Wait for queued OCR to finish before deleting this shipment');
    return;
  }

  const shipmentId = selectedShipment.value._id;
  deletingShipment.value = true;
  try {
    await shipmentStore.remove(shipmentId);
    queuedOcrJobs.value = queuedOcrJobs.value.filter((job) => job.shipmentId !== shipmentId);
    deleteShipmentConfirm.value = false;
    detailsDialog.value = false;
    selectedShipment.value = null;
    expandedOcrImageIds.value = [];
  } finally {
    deletingShipment.value = false;
  }
}

function toShipmentCreate(value: ReturnType<typeof createEmptyDraft>): ShipmentCreate {
  return {
    shippedAt: new Date(value.shippedAt).toISOString(),
    customer: value.customer,
    shipper: value.shipper,
    orderNumber: value.orderNumber,
    trackingNumber: value.trackingNumber,
    carrier: value.carrier,
    notes: value.notes,
    imageIds: [],
  };
}

function shipmentToDraft(shipment: Shipment) {
  return {
    shippedAt: toDatetimeLocal(new Date(shipment.shippedAt)),
    customer:
      typeof shipment.customer === 'string' ? shipment.customer : shipment.customer?._id || null,
    shipper:
      typeof shipment.shipper === 'string' ? shipment.shipper : shipment.shipper?._id || null,
    orderNumber: shipment.orderNumber || '',
    trackingNumber: shipment.trackingNumber || '',
    carrier: shipment.carrier || '',
    notes: shipment.notes || '',
  };
}

function shipmentTitle(shipment: Shipment) {
  if (shipment.orderNumber) return `Order ${shipment.orderNumber}`;
  return `Shipment ${formatShipmentTime(shipment.shippedAt)}`;
}

function customerName(shipment: Shipment) {
  return typeof shipment.customer === 'object' && shipment.customer ? shipment.customer.name : '';
}

function shipperName(shipment: Shipment) {
  if (typeof shipment.shipper === 'object' && shipment.shipper) return shipment.shipper.name;
  return shipment.carrier || '';
}

function shipperNameForDraft(draftValue: ShipmentDraft) {
  if (draftValue.carrier) return draftValue.carrier;
  if (!draftValue.shipper) return '';

  const matchingShipper = shipperStore.shippers.find(
    (shipper) => shipper._id === draftValue.shipper,
  );
  return matchingShipper?.name || '';
}

function carrierValidationMessageForDraft(draftValue: ShipmentDraft) {
  return shipperNameForDraft(draftValue) ? '' : 'Carrier is required.';
}

function normalizeCarrierName(value: string) {
  return value.trim().toLowerCase();
}

function parseTrackingNumbers(value: string | null | undefined) {
  return (value || '')
    .split(/\r?\n/)
    .map((trackingNumber) => trackingNumber.trim())
    .filter(Boolean);
}

function trackingNumbersForDraft(draftValue: ShipmentDraft) {
  return parseTrackingNumbers(draftValue.trackingNumber);
}

function trackingNumbersForShipment(shipment: Shipment) {
  return parseTrackingNumbers(shipment.trackingNumber);
}

function trackingValidationMessageForNumber(carrierName: string, trackingNumber: string) {
  const normalizedCarrier = normalizeCarrierName(carrierName);
  if (!normalizedCarrier || !trackingNumber) return '';

  const normalizedTrackingNumber = trackingNumber.replace(/[\s-]+/g, '');

  if (normalizedCarrier.includes('ups') || normalizedCarrier.includes('united parcel')) {
    if (/^(1Z[0-9A-Z]{16}|[0-9A-Z]{9,26})$/i.test(normalizedTrackingNumber)) return '';
    return `UPS tracking number ${trackingNumber} should look like 1Z followed by 16 letters or numbers.`;
  }

  if (normalizedCarrier.includes('usps') || normalizedCarrier.includes('postal')) {
    if (/^(\d{20,22}|[A-Z]{2}\d{9}[A-Z]{2})$/i.test(normalizedTrackingNumber)) return '';
    return `USPS tracking number ${trackingNumber} should be 20-22 digits or use the USPS international format.`;
  }

  if (normalizedCarrier.includes('fedex') || normalizedCarrier.includes('federal express')) {
    if (/^(\d{12}|\d{15}|\d{20}|\d{22})$/.test(normalizedTrackingNumber)) return '';
    return `FedEx tracking number ${trackingNumber} should be 12, 15, 20, or 22 digits.`;
  }

  return '';
}

function trackingValidationMessageForDraft(draftValue: ShipmentDraft) {
  const carrierName = normalizeCarrierName(shipperNameForDraft(draftValue));
  if (!carrierName) return '';

  for (const trackingNumber of trackingNumbersForDraft(draftValue)) {
    const message = trackingValidationMessageForNumber(carrierName, trackingNumber);
    if (message) return message;
  }

  return '';
}

function trackingUrlForCarrier(carrier: string, trackingNumber: string) {
  const normalizedCarrier = normalizeCarrierName(carrier);
  const normalizedTrackingNumber = trackingNumber.trim();
  if (!normalizedCarrier || !normalizedTrackingNumber) return '';

  const encodedTrackingNumber = encodeURIComponent(normalizedTrackingNumber);

  if (normalizedCarrier.includes('ups') || normalizedCarrier.includes('united parcel')) {
    return `https://www.ups.com/track?tracknum=${encodedTrackingNumber}`;
  }

  if (normalizedCarrier.includes('usps') || normalizedCarrier.includes('postal')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodedTrackingNumber}`;
  }

  if (normalizedCarrier.includes('fedex') || normalizedCarrier.includes('federal express')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodedTrackingNumber}`;
  }

  return '';
}

function trackingUrlForShipment(shipment: Shipment) {
  const [firstTrackingNumber] = trackingNumbersForShipment(shipment);
  return trackingUrlForCarrier(shipperName(shipment), firstTrackingNumber || '');
}

function openTrackingLink(carrier: string, trackingNumber: string) {
  const url = trackingUrlForCarrier(carrier, trackingNumber);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openTrackingLinkForShipment(shipment: Shipment) {
  const [firstTrackingNumber] = trackingNumbersForShipment(shipment);
  if (!firstTrackingNumber) return;
  openTrackingLink(shipperName(shipment), firstTrackingNumber);
}

function imageCount(shipment: Shipment) {
  return shipmentStore.getImages(shipment._id).length || shipment.imageIds?.length || 0;
}

function previewImages(shipment: Shipment) {
  return shipmentStore.getImages(shipment._id);
}

function formatShipmentTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(value: string | Date) {
  return new Date(value).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDatetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function splitDatetimeLocal(value: string) {
  const [date = '', time = ''] = value.split('T');
  return {
    date,
    time: time.slice(0, 5),
  };
}

function joinDatetimeLocal(date: string, time: string) {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

function startOfDayIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfDayIso(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}
</script>

<style scoped>
.infinite-scroll-view-card {
  height: calc(100dvh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.infinite-scroll-view-card__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
}

.shipment-archive {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.shipment-filters,
.shipment-batch__header,
.shipment-row,
.shipment-row__meta,
.shipment-row__count,
.temp-gallery-header,
.details-image-card__footer,
.load-more-row {
  display: flex;
  align-items: center;
}

.details-image-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.details-image-card__meta {
  width: 100%;
  padding: 6px 8px 0;
}

.details-image-card__preview {
  display: block;
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.details-image-card__ocr {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0 6px 6px;
}

.details-image-card__ocr-toggle {
  min-width: 24px;
  transition: transform 0.18s ease;
}

.details-image-card__ocr-toggle--expanded {
  transform: rotate(180deg);
}

.details-image-card__ocr-body {
  width: 100%;
  padding: 4px 2px 2px;
  transform-origin: top;
}

.details-image-card__ocr-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.ocr-expand-enter-active,
.ocr-expand-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    max-height 0.22s ease;
  overflow: hidden;
}

.ocr-expand-enter-from,
.ocr-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px) scaleY(0.98);
  max-height: 0;
}

.ocr-expand-enter-to,
.ocr-expand-leave-from {
  opacity: 1;
  transform: translateY(0) scaleY(1);
  max-height: 320px;
}

.shipment-batch__header,
.temp-gallery-header {
  justify-content: space-between;
  gap: 16px;
}

.shipment-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 160px 160px minmax(220px, 320px);
  gap: 12px;
  align-items: start;
}

.create-shipment-fields {
  margin-inline: -6px;
}

.create-shipment-fields > .v-col {
  padding-top: 0;
  padding-bottom: 0;
  padding-inline: 6px;
}

.search-details {
  display: flex;
  justify-content: flex-end;
  min-height: 18px;
  padding-top: 2px;
}

.clear-filters-hint {
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

.loading-block {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.loading-block--small {
  padding: 22px 0;
}

.shipment-empty-alert {
  flex: 0 0 auto;
}

.shipment-batches,
.shipment-list {
  display: grid;
  gap: 12px;
}

.shipment-batch {
  display: grid;
  gap: 8px;
}

.shipment-row {
  width: 100%;
  min-height: 86px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
  text-align: left;
  cursor: pointer;
  gap: 14px;
}

.shipment-row:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

.shipment-row__thumbs {
  display: grid;
  grid-template-columns: repeat(2, 34px);
  grid-template-rows: repeat(2, 34px);
  flex: 0 0 72px;
  gap: 4px;
}

.shipment-row__thumb,
.shipment-row__empty-thumb {
  width: 34px;
  height: 34px;
  border-radius: 4px;
  object-fit: cover;
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.shipment-row__empty-thumb {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
}

.shipment-row__body {
  min-width: 0;
  flex: 1;
}

.shipment-row__title {
  font-weight: 600;
}

.shipment-row__meta {
  flex-wrap: wrap;
  gap: 6px 12px;
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.875rem;
}

.shipment-row__count {
  gap: 5px;
  min-width: 62px;
  justify-content: flex-end;
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.shipment-tracking-link {
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tracking-field__display {
  width: 100%;
  min-height: 84px;
  padding: 18px 16px 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  text-align: left;
}

.tracking-field__display:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.64);
}

.tracking-field__label {
  margin-bottom: 8px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.75rem;
  line-height: 1;
}

.tracking-field__content {
  display: grid;
  gap: 6px;
}

.tracking-field__placeholder {
  color: rgba(var(--v-theme-on-surface), 0.48);
}

.tracking-field__hint {
  margin-top: 4px;
  color: rgb(var(--v-theme-error));
}

.tracking-links__text {
  color: rgba(var(--v-theme-on-surface), 0.78);
}

.temp-image-card {
  cursor: pointer;
}

.temp-image-card__img,
.details-image-card__img {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.details-dialog {
  min-height: 100dvh;
}

.details-layout {
  display: grid;
  grid-template-columns: minmax(260px, 340px) 1fr;
  gap: 20px;
  align-items: start;
}

.details-panel {
  display: grid;
  gap: 10px;
  position: sticky;
  top: 16px;
}

.details-gallery {
  min-width: 0;
}

.details-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  align-items: start;
}

.details-image-card {
  cursor: pointer;
  align-self: start;
}

.details-image-card__footer {
  justify-content: flex-end;
  gap: 8px;
  padding: 2px 8px 6px;
}

.gallery-dialog {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 100dvh;
  background: #0e0e0e;
}

.gallery-content {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  flex: 1;
  min-height: 0;
  height: calc(100dvh - 64px);
}

.gallery-stage {
  position: relative;
  min-height: 0;
}

.gallery-slide {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px 24px;
  background: #0e0e0e;
}

.gallery-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.gallery-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.42);
  color: white;
  cursor: pointer;
  transform: translateY(-50%);
}

.gallery-nav--prev {
  left: 16px;
}

.gallery-nav--next {
  right: 16px;
}

.gallery-pagination {
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0 18px;
  background: linear-gradient(to top, rgba(14, 14, 14, 0.96), rgba(14, 14, 14, 0));
}

.gallery-pagination__dot {
  width: 12px;
  height: 12px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;
}

.gallery-pagination__dot--active {
  background: white;
  transform: scale(1.2);
}

.load-more-row {
  justify-content: center;
  padding: 8px 0 20px;
}

@media (max-width: 900px) {
  .shipment-filters,
  .details-layout {
    grid-template-columns: 1fr;
  }

  .shipment-row {
    align-items: flex-start;
  }

  .details-panel {
    position: static;
  }
}
</style>
