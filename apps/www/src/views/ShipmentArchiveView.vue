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
      <div class="shipment-filters">
        <v-text-field
          v-model="filters.search"
          clearable
          hide-details
          label="Search"
          prepend-inner-icon="mdi-magnify"
          @click:clear="applyFilters"
          @keyup.enter="applyFilters"
        />
        <v-text-field v-model="filters.from" hide-details label="From" type="date" />
        <v-text-field v-model="filters.to" hide-details label="To" type="date" />
        <CustomerSelect v-model="filters.customer" label="Customer" />
        <v-btn icon="mdi-refresh" title="Refresh" variant="text" @click="applyFilters" />
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
                  <span v-if="shipment.trackingNumber">{{ shipment.trackingNumber }}</span>
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
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="draft.shippedAt"
                label="Shipment Date"
                required
                type="datetime-local"
              />
            </v-col>
            <v-col cols="12" md="6">
              <CustomerSelect v-model="draft.customer" label="Customer" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="draft.orderNumber" label="Order Number" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="draft.trackingNumber" label="Tracking Number" />
            </v-col>
            <v-col cols="12" md="6">
              <ShipperSelect v-model="draft.shipper" label="Carrier" />
            </v-col>
            <v-col cols="12" md="6"> <v-text-field v-model="draft.title" label="Title" /> </v-col>
            <v-col cols="12">
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

    <v-dialog v-model="detailsDialog" fullscreen>
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
            icon="mdi-delete-outline"
            title="Delete Shipment"
            variant="text"
            @click="deleteShipmentConfirm = true"
          />
          <v-btn icon="mdi-close" variant="text" @click="detailsDialog = false" />
        </v-toolbar>

        <v-card-text>
          <div class="details-layout">
            <aside class="details-panel">
              <v-text-field
                v-model="detailDraft.shippedAt"
                density="compact"
                label="Shipment Date"
                type="datetime-local"
              />
              <CustomerSelect v-model="detailDraft.customer" label="Customer" />
              <v-text-field
                v-model="detailDraft.orderNumber"
                density="compact"
                label="Order Number"
              />
              <v-text-field
                v-model="detailDraft.trackingNumber"
                density="compact"
                label="Tracking Number"
              />
              <ShipperSelect v-model="detailDraft.shipper" density="compact" label="Carrier" />
              <v-text-field v-model="detailDraft.title" density="compact" label="Title" />
              <v-textarea
                v-model="detailDraft.notes"
                auto-grow
                density="compact"
                label="Notes"
                rows="3"
              />
              <v-btn
                block
                color="primary"
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
                  :key="image.id"
                  class="details-image-card"
                  hover
                  @click="openGallery(index)"
                >
                  <v-img
                    aspect-ratio="1"
                    class="details-image-card__img"
                    contain
                    :src="image.url"
                  />
                  <div class="details-image-card__footer">
                    <span class="text-caption">{{ formatShortDate(image.createdAt) }}</span>
                    <v-btn
                      color="error"
                      icon="mdi-delete"
                      :loading="deletingImageId === image.id"
                      size="x-small"
                      variant="text"
                      @click.stop="confirmDeleteImage(image)"
                    />
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
      @image-selected="loadSelectedShipmentImages"
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
      This removes the shipment record. Attached images should be removed first if they are no
      longer needed.
    </ConfirmDialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CustomerSelect from '@/components/CustomerSelect.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import ShipperSelect from '@/components/ShipperSelect.vue';
import api from '@/plugins/axios';
import { useShipmentsStore } from '@/stores/shipments_store';

type TempImage = MyImageData & { status?: 'temp' };

const shipmentStore = useShipmentsStore();

const filters = ref({
  search: '',
  from: '',
  to: '',
  customer: null as string | null,
});

const createDialog = ref(false);
const detailsDialog = ref(false);
const addImagesDialog = ref(false);
const deleteImageConfirm = ref(false);
const deleteShipmentConfirm = ref(false);
const savingShipment = ref(false);
const savingDetails = ref(false);
const deletingShipment = ref(false);
const loadingTempImages = ref(false);
const loadingShipmentImages = ref(false);
const deletingImageId = ref('');
const galleryOpen = ref(false);
const galleryIndex = ref(0);
const selectedShipment = ref<Shipment | null>(null);
const deleteImageTarget = ref<MyImageData | null>(null);
const tempImages = ref<TempImage[]>([]);
const selectedTempImageIds = ref<string[]>([]);
let searchDebounceId: ReturnType<typeof setTimeout> | null = null;

const draft = ref(createEmptyDraft());
const detailDraft = ref(createEmptyDraft());

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

function createEmptyDraft() {
  return {
    shippedAt: toDatetimeLocal(new Date()),
    title: '',
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

async function loadMore() {
  await shipmentStore.fetchNextPage();
}

function openCreateDialog() {
  draft.value = createEmptyDraft();
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
  savingShipment.value = true;
  try {
    await shipmentStore.create(toShipmentCreate(draft.value), selectedTempImageIds.value);
    createDialog.value = false;
  } finally {
    savingShipment.value = false;
  }
}

async function openDetails(shipment: Shipment) {
  selectedShipment.value = shipment;
  detailDraft.value = shipmentToDraft(shipment);
  detailsDialog.value = true;
  await loadSelectedShipmentImages();
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

function openGallery(index: number) {
  galleryIndex.value = index;
  galleryOpen.value = true;
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
  savingDetails.value = true;
  try {
    const updated = await shipmentStore.update({
      ...toShipmentCreate(detailDraft.value),
      _id: selectedShipment.value._id,
      imageIds: selectedImages.value.map((image) => image.id),
    });
    selectedShipment.value = updated;
    detailDraft.value = shipmentToDraft(updated);
  } finally {
    savingDetails.value = false;
  }
}

function confirmDeleteImage(image: MyImageData) {
  deleteImageTarget.value = image;
  deleteImageConfirm.value = true;
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

async function deleteSelectedShipment() {
  if (!selectedShipment.value) return;
  deletingShipment.value = true;
  try {
    await shipmentStore.remove(selectedShipment.value._id);
    deleteShipmentConfirm.value = false;
    detailsDialog.value = false;
    selectedShipment.value = null;
  } finally {
    deletingShipment.value = false;
  }
}

function toShipmentCreate(value: ReturnType<typeof createEmptyDraft>): ShipmentCreate {
  return {
    shippedAt: new Date(value.shippedAt).toISOString(),
    title: value.title,
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
    title: shipment.title || '',
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
  if (shipment.title) return shipment.title;
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

.shipment-batch__header,
.temp-gallery-header {
  justify-content: space-between;
  gap: 16px;
}

.shipment-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 160px 160px minmax(220px, 320px) auto;
  gap: 12px;
  align-items: start;
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
}

.details-image-card {
  cursor: pointer;
}

.details-image-card__footer {
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
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
