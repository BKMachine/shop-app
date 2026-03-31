<template>
  <div class="part-images-details">
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h3 class="text-h6">Part Images</h3>
        <p class="text-medium-emphasis text-body-2">{{ imageCountLabel }}</p>
      </div>

      <v-btn
        color="primary"
        :disabled="!part._id"
        prepend-icon="mdi-image-plus-outline"
        variant="elevated"
        @click="openImageManager"
      >
        Add Images
      </v-btn>
    </div>

    <v-alert v-if="!part._id" type="info" variant="tonal">
      Save this part first, then you can upload and manage images.
    </v-alert>

    <v-card v-else>
      <v-card-text>
        <div v-if="loading" class="d-flex justify-center my-6">
          <v-progress-circular indeterminate />
        </div>

        <div v-else-if="error" class="text-error">{{ error }}</div>

        <div v-else-if="!images.length" class="text-medium-emphasis py-4">
          No images yet. Click <strong>Add Images</strong> to upload.
        </div>

        <v-row v-else dense>
          <v-col
            v-for="(image, index) in sortedImages"
            :key="image.id"
            cols="6"
            lg="2"
            md="3"
            sm="4"
          >
            <v-card class="thumb-card" hover @click="openGallery(index)">
              <v-img aspect-ratio="1" cover :src="image.url" />
              <v-chip
                v-if="image.isMain"
                class="thumb-card__main-chip"
                color="primary"
                size="small"
                variant="elevated"
              >
                Main
              </v-chip>
              <v-card-subtitle class="text-caption py-2 px-2 text-truncate">
                {{ formatImageDate(image.createdAt) }}
              </v-card-subtitle>
              <div class="thumb-card__actions px-2 pb-2">
                <v-btn
                  v-if="!image.isMain"
                  class="thumb-card__action"
                  :loading="promotingId === image.id"
                  size="x-small"
                  variant="tonal"
                  @click.stop="promoteToMain(image)"
                >
                  Use As Main
                </v-btn>
                <div v-else class="thumb-card__action thumb-card__action-spacer" />
                <v-btn
                  class="thumb-card__delete"
                  color="error"
                  icon="mdi-delete"
                  :loading="deletingId === image.id"
                  size="x-small"
                  variant="outlined"
                  @click.stop="confirmDeleteImage(image)"
                />
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-dialog v-model="galleryOpen" content-class="gallery-overlay" fullscreen>
      <v-card class="gallery-dialog">
        <v-toolbar color="black" density="comfortable" theme="dark">
          <v-toolbar-title> {{ galleryTitle }} </v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="galleryOpen = false" />
        </v-toolbar>

        <v-card-text class="gallery-content pa-0">
          <div class="gallery-stage">
            <button
              v-if="images.length > 1"
              aria-label="Previous image"
              class="gallery-nav gallery-nav--prev"
              type="button"
              @click="showPreviousImage"
            >
              <v-icon icon="mdi-chevron-left" />
            </button>

            <div class="gallery-slide">
              <img
                v-if="sortedImages[galleryIndex]"
                alt=""
                class="gallery-image"
                :src="sortedImages[galleryIndex]?.url"
              />
            </div>

            <button
              v-if="images.length > 1"
              aria-label="Next image"
              class="gallery-nav gallery-nav--next"
              type="button"
              @click="showNextImage"
            >
              <v-icon icon="mdi-chevron-right" />
            </button>
          </div>

          <div v-if="images.length > 1" class="gallery-pagination">
            <button
              v-for="(_, index) in sortedImages"
              :key="`gallery-dot-${index}`"
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
      v-model="imageManagerVisible"
      :entity-id="part._id"
      entity-type="part"
      :has-image="Boolean(part.img)"
      :title="part.description"
      @image-selected="onImageSelected"
    />

    <ConfirmDialog
      v-model="deleteConfirmVisible"
      confirm-text="Delete"
      :loading="Boolean(deleteTarget && deletingId === deleteTarget.id)"
      title="Delete Image?"
      @confirm="deleteConfirmedImage"
    >
      This will permanently remove the image from this part.
      <span v-if="deleteTarget?.isMain">
        <br />
        The current main image will also be replaced.
      </span>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import { socket } from '@/plugins/socket';
import { usePartStore } from '@/stores/parts_store';

const props = defineProps<{
  part: Part;
}>();

const emit = defineEmits<{
  'image-selected': [payload: { imageId: string; url: string; isMain?: boolean }];
}>();

const partStore = usePartStore();

const imageManagerVisible = ref(false);
const loading = ref(false);
const error = ref('');
const images = ref<MyImageData[]>([]);
const galleryOpen = ref(false);
const galleryIndex = ref(0);
const promotingId = ref('');
const deletingId = ref('');
const deleteConfirmVisible = ref(false);
const deleteTarget = ref<MyImageData | null>(null);

const sortedImages = computed(() => {
  return [...images.value].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
});

const handleImagePromoted = (data: { imageId: string; entityType: string; entityId: string }) => {
  if (data.entityType === 'part' && data.entityId === props.part._id) {
    loadImages();
  }
};

const handleImageAttached = (data: { imageId: string; entityType: string; entityId: string }) => {
  if (data.entityType === 'part' && data.entityId === props.part._id) {
    loadImages();
  }
};

const handleImageAddedToGallery = (data: {
  imageId: string;
  entityType: string;
  entityId: string;
}) => {
  if (data.entityType === 'part' && data.entityId === props.part._id) {
    loadImages();
  }
};

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

onMounted(() => {
  loadImages();
  window.addEventListener('keydown', handleGalleryKeydown);
  socket.on('imagePromoted', handleImagePromoted);
  socket.on('imageAttached', handleImageAttached);
  socket.on('imageAddedToGallery', handleImageAddedToGallery);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGalleryKeydown);
  socket.off('imagePromoted', handleImagePromoted);
  socket.off('imageAttached', handleImageAttached);
  socket.off('imageAddedToGallery', handleImageAddedToGallery);
});

const imageCountLabel = computed(() => {
  const count = images.value.length;
  return count === 1 ? '1 image' : `${count} images`;
});

const galleryTitle = computed(() => {
  if (!images.value.length) return 'Image Gallery';
  return `Image ${galleryIndex.value + 1} of ${images.value.length}`;
});

function openImageManager() {
  imageManagerVisible.value = true;
}

function openGallery(index: number) {
  galleryIndex.value = index;
  galleryOpen.value = true;
}

function showPreviousImage() {
  if (!images.value.length) return;
  galleryIndex.value =
    galleryIndex.value === 0 ? sortedImages.value.length - 1 : galleryIndex.value - 1;
}

function showNextImage() {
  if (!images.value.length) return;
  galleryIndex.value =
    galleryIndex.value === sortedImages.value.length - 1 ? 0 : galleryIndex.value + 1;
}

function formatImageDate(createdAt: string): string {
  return new Date(createdAt).toLocaleString();
}

async function promoteToMain(image: MyImageData) {
  if (!props.part._id || image.isMain) return;

  promotingId.value = image.id;
  error.value = '';

  try {
    const data = await partStore.promotePartImage(props.part._id, image.id);
    emit('image-selected', { imageId: image.id, url: data.url, isMain: true });
  } catch (err) {
    error.value = 'Failed to set main image.';
    console.error(err);
  } finally {
    promotingId.value = '';
  }
}

function confirmDeleteImage(image: MyImageData) {
  deleteTarget.value = image;
  deleteConfirmVisible.value = true;
}

function closeDeleteConfirm() {
  if (deletingId.value) return;
  deleteConfirmVisible.value = false;
  deleteTarget.value = null;
}

async function deleteConfirmedImage() {
  if (!deleteTarget.value) return;
  await deleteImage(deleteTarget.value);
}

async function deleteImage(image: MyImageData) {
  if (!props.part._id) return;

  deletingId.value = image.id;
  error.value = '';

  try {
    const data = await partStore.deletePartImage(props.part._id, image.id);
    emit('image-selected', {
      imageId: data.nextMainImageId || '',
      url: data.nextMainImageUrl || '',
      isMain: true,
    });

    if (galleryOpen.value && galleryIndex.value >= images.value.length - 1) {
      galleryIndex.value = Math.max(0, images.value.length - 2);
    }

    deleteConfirmVisible.value = false;
    deleteTarget.value = null;
  } catch (err) {
    error.value = 'Failed to delete image.';
    console.error(err);
  } finally {
    deletingId.value = '';
  }
}

async function loadImages() {
  if (!props.part._id) {
    images.value = [];
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    images.value = await partStore.loadPartImages(props.part._id);
  } catch (err) {
    error.value = 'Failed to load images.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function onImageSelected(payload: { imageId: string; url: string; isMain?: boolean }) {
  emit('image-selected', payload);
  loadImages();
}

watch(
  () => props.part._id,
  () => {
    loadImages();
  },
);

watch(galleryOpen, (isOpen) => {
  if (!isOpen) {
    galleryIndex.value = 0;
  }
});
</script>

<style scoped>
.thumb-card {
  position: relative;
  cursor: pointer;
  transition: transform 0.16s ease;
}

.thumb-card:hover {
  transform: translateY(-2px);
}

.thumb-card__main-chip {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28);
}

.thumb-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.thumb-card__action {
  min-width: 0;
}

.thumb-card__action-spacer {
  flex: 1;
}

.thumb-card__delete {
  background: rgba(255, 255, 255, 0.92);
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
  background: rgba(255, 255, 255, 0.95);
  transform: scale(1.18);
}
</style>
