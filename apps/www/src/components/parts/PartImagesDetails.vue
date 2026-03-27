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

    <v-dialog v-model="galleryOpen" fullscreen>
      <v-card class="gallery-dialog">
        <v-toolbar color="black" density="comfortable" theme="dark">
          <v-toolbar-title> {{ galleryTitle }} </v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="galleryOpen = false" />
        </v-toolbar>

        <v-card-text class="gallery-content pa-0">
          <v-carousel
            v-model="galleryIndex"
            class="gallery-carousel"
            hide-delimiter-background
            :hide-delimiters="images.length <= 1"
            show-arrows="hover"
          >
            <v-carousel-item v-for="image in sortedImages" :key="`gallery-${image.id}`">
              <div class="gallery-slide"><v-img contain height="100%" :src="image.url" /></div>
            </v-carousel-item>
          </v-carousel>
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

    <v-dialog v-model="deleteConfirmVisible" max-width="500">
      <v-card>
        <v-card-title>Delete Image?</v-card-title>
        <v-card-text>
          This will permanently remove the image from this part.
          <span v-if="deleteTarget?.isMain"
            ><br />
            The current main image will also be replaced.
          </span>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDeleteConfirm">Cancel</v-btn>
          <v-btn
            color="error"
            :loading="Boolean(deleteTarget && deletingId === deleteTarget.id)"
            variant="flat"
            @click="deleteConfirmedImage"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';

const props = defineProps<{
  part: Part;
}>();

const emit = defineEmits<{
  'image-selected': [payload: { imageId: string; url: string; isMain?: boolean }];
}>();

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

onMounted(() => {
  loadImages();
  socket.on('imagePromoted', handleImagePromoted);
  socket.on('imageAttached', handleImageAttached);
  socket.on('imageAddedToGallery', handleImageAddedToGallery);
});

onBeforeUnmount(() => {
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

function formatImageDate(createdAt: string): string {
  return new Date(createdAt).toLocaleString();
}

async function promoteToMain(image: MyImageData) {
  if (!props.part._id || image.isMain) return;

  promotingId.value = image.id;
  error.value = '';

  console.log(promotingId.value, props.part._id);
  try {
    const { data } = await api.post<MyImageData>(`/images/${image.id}/promote-to-main`, {
      entityType: 'part',
      entityId: props.part._id,
    });

    emit('image-selected', { imageId: image.id, url: data.url, isMain: true });
    await loadImages();
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
    const { data } = await api.delete<{ nextMainImageId?: string; nextMainImageUrl?: string }>(
      `/images/entities/part/${props.part._id}/images/${image.id}`,
    );

    emit('image-selected', {
      imageId: data.nextMainImageId || '',
      url: data.nextMainImageUrl || '',
      isMain: true,
    });

    if (galleryOpen.value && galleryIndex.value >= images.value.length - 1) {
      galleryIndex.value = Math.max(0, images.value.length - 2);
    }

    await loadImages();
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
    const res = await api.get<MyImageData[]>(`/images/entities/part/${props.part._id}/images`);
    images.value = res.data;
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
  background: #0e0e0e;
}

.gallery-content {
  height: calc(100vh - 64px);
}

.gallery-carousel,
.gallery-slide {
  height: 100%;
}

.gallery-slide {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0e0e0e;
}
</style>
