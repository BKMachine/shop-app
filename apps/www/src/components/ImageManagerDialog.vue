<template>
  <v-dialog v-model="dialog" width="900">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Image Manager</span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="dialog = false" />
      </v-card-title>

      <v-tabs v-model="currentTab">
        <v-tab value="upload">Upload</v-tab>
        <v-tab value="gallery">Gallery</v-tab>
      </v-tabs>

      <v-window v-model="currentTab">
        <!-- Upload Tab -->
        <v-window-item value="upload">
          <v-card-text class="upload-tab-root">
            <div
              :aria-disabled="!!urlInput"
              class="upload-drop-area"
              :class="{ 'upload-drop-area--disabled': !!urlInput }"
              @click="!urlInput && triggerFileInput()"
            >
              <v-icon color="primary" size="64">mdi-image</v-icon>
              <div class="upload-drop-text">
                <span>Drop your image here, or <span class="upload-browse">browse</span></span>
              </div>
              <div class="upload-drop-types">Supports: PNG, JPG, JPEG, WEBP</div>
              <input
                ref="fileInputRef"
                accept="image/*"
                :disabled="uploadLoading || !!urlInput"
                style="display: none"
                type="file"
                @change="onFileInputChange"
              />
            </div>
            <div v-if="selectedFile" class="upload-file-info">
              <v-icon size="20">mdi-file-image</v-icon>
              <span class="upload-file-name">{{ selectedFile.name }}</span>
              <v-progress-linear
                v-if="uploadLoading"
                class="upload-progress"
                color="primary"
                height="6"
                :value="uploadProgress"
              />
              <v-btn :disabled="uploadLoading" icon size="x-small" @click="removeSelectedFile">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>
            <div v-if="filePreviewUrl" class="upload-url-preview">
              <img alt="Preview" class="upload-url-img-preview" :src="filePreviewUrl" />
            </div>
            <div class="upload-or-divider"><span>or</span></div>
            <div class="upload-url-row">
              <v-text-field
                v-model="urlInput"
                class="upload-url-input"
                clearable
                :disabled="uploadLoading || !!selectedFile"
                hide-details
                label="Add image URL"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div v-if="validImageUrl" class="upload-url-preview">
              <img
                alt="Invalid URL"
                class="upload-url-img-preview"
                :src="urlInput"
                @error="urlPreviewLoaded = false"
                @load="urlPreviewLoaded = true"
              />
            </div>

            <div v-if="uploadError" class="text-error mt-2">{{ uploadError }}</div>
            <div v-if="uploadSuccess" class="text-success mt-2">Image uploaded successfully!</div>
            <div class="upload-actions-row">
              <v-spacer />
              <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
              <v-btn
                color="primary"
                :disabled="(!selectedFile && !(validImageUrl && urlPreviewLoaded)) || uploadLoading"
                :loading="uploadLoading"
                variant="flat"
                @click="importImage"
                >Upload</v-btn
              >
            </div>
          </v-card-text>
        </v-window-item>

        <!-- Gallery Tab -->
        <v-window-item value="gallery">
          <v-card-text>
            <div v-if="loadingGallery" class="d-flex justify-center my-6">
              <v-progress-circular indeterminate />
            </div>

            <div v-else-if="galleryError" class="text-error">{{ galleryError }}</div>

            <div v-else-if="!allImages.length" class="text-medium-emphasis">
              No images available. Upload one to get started.
            </div>

            <v-row v-else dense>
              <v-col v-for="img in allImages" :key="img.id" cols="6" lg="2" md="3" sm="4">
                <v-card
                  :border="isMainImage(img.id)"
                  class="image-card pa-1 position-relative"
                  :color="isMainImage(img.id) ? 'primary' : ''"
                  elevation="2"
                  hover
                >
                  <v-img aspect-ratio="1" cover :src="img.url" />

                  <v-chip
                    v-if="isMainImage(img.id)"
                    class="position-absolute"
                    color="primary"
                    size="small"
                    style="top: 5px; right: 5px"
                  >
                    Main
                  </v-chip>

                  <v-card-subtitle class="image-card__date text-caption mt-1 px-2">
                    {{ formatImageDate(img.createdAt) }}
                  </v-card-subtitle>

                  <div
                    class="image-card__actions d-flex align-center justify-space-between px-2 pb-2"
                  >
                    <v-btn
                      v-if="!isMainImage(img.id)"
                      class="image-card__primary-action"
                      :loading="promotingId === img.id"
                      size="x-small"
                      title="Set as main image"
                      variant="tonal"
                      @click="promoteToMain(img)"
                    >
                      Use As Main
                    </v-btn>
                    <div v-else class="image-card__primary-action" />
                    <v-btn
                      v-if="img.status === 'temp'"
                      class="image-card__delete"
                      color="error"
                      icon="mdi-delete"
                      :loading="deletingId === img.id"
                      size="xx-small"
                      title="Delete temporary image"
                      variant="outlined"
                      @click="deleteImage(img.id)"
                    />
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';

interface ImageData {
  id: string;
  url: string;
  filename?: string;
  createdAt: string;
  status?: 'temp' | 'attached';
  isMain?: boolean;
}

const props = defineProps<{
  modelValue: boolean;
  partId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  'image-selected': [payload: { imageId: string; url: string }];
}>();

const dialog = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

// Tabs
const currentTab = ref<'upload' | 'gallery'>('gallery');

// Upload
const fileInput = ref<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const urlInput = ref('');
const uploadLoading = ref(false);
const uploadError = ref('');
const uploadSuccess = ref(false);
const uploadProgress = ref(0);

function onFileInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    selectedFile.value = files[0] ?? null;
  }
}

function removeSelectedFile() {
  selectedFile.value = null;
  filePreviewUrl.value = null;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

async function importImage() {
  if (selectedFile.value) {
    await uploadFile();
  } else if (urlInput.value) {
    await uploadUrl();
  }
}

// Gallery
const loadingGallery = ref(false);
const galleryError = ref('');
const tempImages = ref<ImageData[]>([]);
const partImages = ref<ImageData[]>([]);
const mainImageId = ref('');
const promotingId = ref('');
const deletingId = ref('');

const allImages = computed(() => {
  const combined = [...partImages.value, ...tempImages.value];
  // Remove duplicates
  const seen = new Set<string>();
  const deduped = combined.filter((img) => {
    if (seen.has(img.id)) return false;
    seen.add(img.id);
    return true;
  });

  return deduped.sort((left, right) => {
    if (left.id === mainImageId.value) return -1;
    if (right.id === mainImageId.value) return 1;

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
});

const isMainImage = (imageId: string): boolean => {
  return mainImageId.value === imageId;
};

function formatImageDate(createdAt: string): string {
  return new Date(createdAt).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Socket listeners
socket.on('imageUploaded', () => {
  loadGallery();
});

socket.on('imagePromoted', (data: { imageId: string; partId: string }) => {
  if (data.partId === props.partId) {
    loadGallery();
  }
});

socket.on('imageDeleted', () => {
  loadGallery();
});

// Load gallery on mount and when partId changes
onMounted(() => {
  loadGallery();
});

watch(
  () => props.partId,
  () => {
    loadGallery();
  },
);

async function loadGallery() {
  loadingGallery.value = true;
  galleryError.value = '';

  try {
    // Load recent temp images
    const recentRes = await api.get('/images/uploads/recent');
    tempImages.value = recentRes.data.map((img: any) => ({
      id: img.id,
      url: img.url,
      createdAt: img.createdAt,
      status: 'temp',
    }));

    // Load part's attached images
    if (props.partId) {
      const partsRes = await api.get(`/images/parts/${props.partId}/images`);
      partImages.value = partsRes.data;

      if (partsRes.data && partsRes.data.length > 0) {
        mainImageId.value = partsRes.data[0].id;
      } else {
        mainImageId.value = '';
      }
    } else {
      partImages.value = [];
      mainImageId.value = '';
    }
  } catch (err) {
    galleryError.value = 'Failed to load images';
    console.error(err);
  } finally {
    loadingGallery.value = false;
  }
}

async function uploadFile() {
  if (!selectedFile.value) return;
  uploadLoading.value = true;
  uploadError.value = '';
  uploadSuccess.value = false;
  uploadProgress.value = 0;
  try {
    const file = selectedFile.value;
    const formData = new FormData();
    formData.append('image', file as Blob);
    await api.post('/images/uploads/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent: any) => {
        if (progressEvent?.lengthComputable) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        }
      },
    });
    uploadSuccess.value = true;
    selectedFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
    setTimeout(() => {
      currentTab.value = 'gallery';
      uploadSuccess.value = false;
    }, 1500);
  } catch (err) {
    uploadError.value = 'Failed to upload file';
    console.error(err);
  } finally {
    uploadLoading.value = false;
    uploadProgress.value = 0;
  }
}

async function uploadUrl() {
  if (!urlInput.value) return;

  uploadLoading.value = true;
  uploadError.value = '';
  uploadSuccess.value = false;

  try {
    await api.post('/images/uploads/url', { url: urlInput.value });

    uploadSuccess.value = true;
    urlInput.value = '';
    setTimeout(() => {
      currentTab.value = 'gallery';
      uploadSuccess.value = false;
    }, 1500);
  } catch (err) {
    uploadError.value = 'Failed to download and upload image';
    console.error(err);
  } finally {
    uploadLoading.value = false;
  }
}

async function promoteToMain(image: ImageData) {
  if (!props.partId) {
    galleryError.value = 'Save the part before selecting a main image.';
    return;
  }

  promotingId.value = image.id;
  try {
    let selectedUrl = image.url;

    if (image.status === 'temp') {
      const { data } = await api.post(`/images/uploads/${image.id}/attach`, {
        entityType: 'part',
        entityId: props.partId,
        setAsMain: true,
      });
      selectedUrl = data.url;
    } else {
      const { data } = await api.post(`/images/${image.id}/promote-to-main`, {
        partId: props.partId,
      });
      selectedUrl = data.url;
    }

    mainImageId.value = image.id;
    emit('image-selected', { imageId: image.id, url: selectedUrl });
    await loadGallery();
    dialog.value = false;
  } catch (err) {
    console.error('Failed to promote image:', err);
  } finally {
    promotingId.value = '';
  }
}

async function deleteImage(imageId: string) {
  deletingId.value = imageId;
  try {
    await api.delete(`/images/uploads/${imageId}`);
    tempImages.value = tempImages.value.filter((img) => img.id !== imageId);
  } catch (err) {
    console.error('Failed to delete image:', err);
  } finally {
    deletingId.value = '';
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

const validImageUrl = computed(() => {
  if (!urlInput.value) return false;
  try {
    const url = new URL(urlInput.value);
    // Basic check for image extension
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(url.pathname);
  } catch {
    return false;
  }
});

const filePreviewUrl = ref<string | null>(null);

watch(selectedFile, (file) => {
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      filePreviewUrl.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  } else {
    filePreviewUrl.value = null;
  }
});

const urlPreviewLoaded = ref(false);

watch(urlInput, () => {
  urlPreviewLoaded.value = false;
});
</script>

<style scoped>
/* Upload Tab Modern Styles */
/* Compact Upload Tab Styles */
.upload-tab-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  background: #f8fafd;
  border-radius: 14px;
  padding: 1.2rem 1rem 1rem 1rem;
}
.upload-drop-area {
  width: 100%;
  max-width: 400px;
  min-height: 160px;
  border: 2px dashed #bfc9da;
  border-radius: 10px;
  background: #f4f7fb;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
  margin-bottom: 0.2rem;
  padding: 0.7rem 0.5rem;
}
.upload-drop-area:hover {
  border-color: #1976d2;
}
.upload-drop-text {
  font-size: 1rem;
  margin-top: 0.2rem;
  margin-bottom: 0.1rem;
}
.upload-browse {
  color: #1976d2;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
}
.upload-drop-types {
  font-size: 0.9rem;
  color: #8a94a6;
  margin-bottom: 0.2rem;
}
.upload-file-info {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  padding: 0.3rem 0.7rem;
  margin-bottom: 0.2rem;
}
.upload-file-name {
  flex: 1;
  font-size: 0.97rem;
  color: #222b45;
}
.upload-progress {
  flex: 2;
  margin: 0 0.3rem;
}
.upload-or-divider {
  width: 100%;
  max-width: 400px;
  text-align: center;
  color: #bfc9da;
  font-size: 0.9rem;
  margin: 0.2rem 0 0.2rem 0;
  position: relative;
}
.upload-or-divider span {
  background: #f8fafd;
  padding: 0 0.7rem;
  position: relative;
  z-index: 1;
}
.upload-or-divider:before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: #e3e8f0;
  z-index: 0;
}
.upload-url-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  max-width: 400px;
}
.upload-url-input {
  flex: 1;
}
.upload-url-btn {
  min-width: 80px;
}
.upload-actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
  width: 100%;
  margin-top: 1.2rem;
}
.image-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.image-card__date {
  line-height: 1.25;
  min-height: 2.75rem;
  white-space: normal;
}

.image-card__actions {
  gap: 0.5rem;
  margin-top: auto;
  min-height: 2rem;
}

.image-card__primary-action {
  min-width: 0;
}

.image-card__delete {
  flex: 0 0 auto;
}

.position-relative {
  position: relative;
}

.position-absolute {
  position: absolute;
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

/* Disabled drop area style */
.upload-drop-area--disabled {
  opacity: 0.5;
  pointer-events: none;
  cursor: not-allowed;
}

.upload-url-img-preview {
  max-width: 100%;
  max-height: 100px;
  object-fit: contain;
}
</style>
