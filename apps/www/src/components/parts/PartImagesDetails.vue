<template>
  <div class="images-container">
    <!-- Main Image Section -->
    <v-card v-if="mainImage" class="mb-6">
      <v-card-title>Main Image</v-card-title>
      <v-card-text>
        <div class="d-flex gap-4">
          <v-img aspect-ratio="1" class="main-image" max-width="300" :src="mainImage.url" />
          <div class="d-flex flex-column justify-space-between flex-grow-1">
            <div>
              <p><strong>Filename:</strong> {{ mainImage.filename }}</p>
              <p><strong>Added:</strong> {{ new Date(mainImage.createdAt).toLocaleString() }}</p>
            </div>
            <div class="d-flex gap-2">
              <v-btn color="blue" @click="openImageManager"> Select Different Main Image </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- No Main Image State -->
    <v-alert v-else class="mb-6" type="info">
      <p class="mb-2">No main image selected.</p>
      <v-btn color="blue" @click="openImageManager"> Upload or Select an Image </v-btn>
    </v-alert>

    <!-- Gallery Section -->
    <v-card>
      <v-card-title>Image Gallery</v-card-title>
      <v-card-text>
        <div v-if="loadingGallery" class="d-flex justify-center my-6">
          <v-progress-circular indeterminate />
        </div>

        <div v-else-if="galleryError" class="text-error">{{ galleryError }}</div>

        <div v-else-if="!galleryImages.length" class="text-medium-emphasis">
          No gallery images. Click the button below to add images.
        </div>

        <v-row v-else dense>
          <v-col v-for="img in galleryImages" :key="img.id" cols="6" lg="2" md="3" sm="4">
            <v-card elevation="2" hover>
              <v-img aspect-ratio="1" cover :src="img.url" />

              <v-card-subtitle class="text-caption mt-1">
                {{ new Date(img.createdAt).toLocaleString() }}
              </v-card-subtitle>

              <!-- Actions -->
              <div class="d-flex gap-1 mt-2 pa-2">
                <v-btn
                  :loading="promotingId === img.id"
                  size="x-small"
                  title="Set as main image"
                  variant="tonal"
                  @click="promoteToMain(img.id)"
                >
                  ⭐ Main
                </v-btn>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Action Button -->
    <div class="mt-4 d-flex gap-2">
      <v-btn color="blue" prepend-icon="mdi-image-plus" @click="openImageManager">
        Manage Images
      </v-btn>
    </div>

    <!-- Image Manager Dialog -->
    <ImageManagerDialog
      v-model="imageManagerVisible"
      :part-id="part._id || ''"
      @image-selected="onImageSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';

interface ImageData {
  id: string;
  url: string;
  filename?: string;
  createdAt: string;
  isMain?: boolean;
}

const props = defineProps<{
  part: Part;
}>();

const imageManagerVisible = ref(false);
const loadingGallery = ref(false);
const galleryError = ref('');
const galleryImagesData = ref<ImageData[]>([]);
const promotingId = ref('');

const mainImage = computed(() => {
  return galleryImagesData.value.length > 0 ? galleryImagesData.value[0] : null;
});

const galleryImages = computed(() => {
  // All images except the first one (which is main)
  return galleryImagesData.value.slice(1);
});

// Socket listeners for real-time updates
socket.on('imagePromoted', (data: { imageId: string; partId: string }) => {
  if (data.partId === props.part._id) {
    loadGallery();
  }
});

socket.on('imageAttached', (data: { imageId: string; entityType: string; entityId: string }) => {
  if (data.entityType === 'part' && data.entityId === props.part._id) {
    loadGallery();
  }
});

socket.on('imageAddedToGallery', (data: { imageId: string; partId: string }) => {
  if (data.partId === props.part._id) {
    loadGallery();
  }
});

onMounted(() => {
  if (props.part._id) {
    loadGallery();
  }
});

async function loadGallery() {
  if (!props.part._id) return;

  loadingGallery.value = true;
  galleryError.value = '';

  try {
    const res = await api.get(`/images/parts/${props.part._id}/images`);
    galleryImagesData.value = res.data;
  } catch (err) {
    galleryError.value = 'Failed to load images';
    console.error(err);
  } finally {
    loadingGallery.value = false;
  }
}

function openImageManager() {
  imageManagerVisible.value = true;
}

async function promoteToMain(imageId: string) {
  if (!props.part._id) return;

  promotingId.value = imageId;
  try {
    await api.post(`/images/${imageId}/promote-to-main`, {
      partId: props.part._id,
    });
    await loadGallery();
  } catch (err) {
    console.error('Failed to promote image:', err);
  } finally {
    promotingId.value = '';
  }
}

function onImageSelected(_payload: { imageId: string; url: string }) {
  loadGallery();
}
</script>

<style scoped>
.images-container {
  padding: 1rem;
}

.main-image {
  border: 3px solid #1976d2;
  border-radius: 4px;
}

.gap-4 {
  gap: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-1 {
  gap: 0.25rem;
}
</style>
