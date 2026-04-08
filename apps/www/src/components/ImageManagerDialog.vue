<template>
  <v-dialog v-model="dialog" width="900">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Image Manager<span v-if="title"> - {{ title }}</span></span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="dialog = false" />
      </v-card-title>

      <template v-if="!initializingDialog">
        <v-tabs v-model="currentTab">
          <v-tab value="upload">Upload</v-tab>
          <v-tab value="gallery">Temp Gallery</v-tab>
          <v-tab v-if="showItemGalleryTab" value="item">Item Gallery</v-tab>
        </v-tabs>

        <v-window v-model="currentTab">
          <!-- Upload Tab -->
          <v-window-item value="upload">
            <v-card-text class="upload-tab-root">
              <div
                v-if="!urlInput"
                :aria-disabled="!!urlInput"
                class="upload-drop-area"
                :class="{
                  'upload-drop-area--disabled': !!urlInput,
                  'upload-drop-area--active': isDragging,
                }"
                @click="!urlInput && triggerFileInput()"
                @dragenter.prevent="onDragEnter"
                @dragleave.prevent="onDragLeave"
                @dragover.prevent="onDragOver"
                @drop.prevent="onDrop"
              >
                <v-icon color="primary" size="64">mdi-image</v-icon>
                <div class="upload-drop-text">
                  <span>
                    Drop your image here, <span class="upload-browse">browse</span>, or paste from
                    clipboard
                  </span>
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
              <div v-if="filePreviewUrl" class="upload-file-preview">
                <img alt="Preview" class="upload-file-img-preview" :src="filePreviewUrl" />
              </div>
              <div v-if="!urlInput && !selectedFile " class="upload-or-divider">
                <span>or</span>
              </div>
              <div class="upload-url-row">
                <v-text-field
                  v-if="!selectedFile"
                  v-model="urlInput"
                  class="upload-url-input"
                  clearable
                  :disabled="uploadLoading || !!selectedFile"
                  hide-details
                  label="Add image URL"
                  placeholder="https://example.com/image.jpg"
                  @click:clear="onUrlClear"
                />
              </div>
              <div
                v-if="validImageUrl && urlPreviewLoading"
                class="text-medium-emphasis text-body-2"
              >
                Checking image preview...
              </div>
              <div v-if="validImageUrl" class="upload-url-preview">
                <img
                  alt="URL preview"
                  class="upload-url-img-preview"
                  :src="normalizedUrlInput"
                  @error="onUrlPreviewError"
                  @load="onUrlPreviewLoad"
                />
              </div>
              <div v-if="validImageUrl && urlPreviewError" class="text-error text-body-2">
                The URL did not load as an image in preview.
              </div>

              <div v-if="uploadError" class="text-error mt-2">{{ uploadError }}</div>
              <div v-if="uploadSuccess" class="text-success mt-2">Image uploaded successfully!</div>
              <div class="upload-actions-row">
                <v-spacer />
                <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                <v-btn
                  v-if="props.entityId"
                  color="secondary"
                  :disabled="(!selectedFile && !canUploadFromUrl) || uploadLoading"
                  :loading="uploadLoading"
                  variant="outlined"
                  @click="importImage(false)"
                >
                  Upload To Temp
                </v-btn>
                <v-btn
                  color="primary"
                  :disabled="(!selectedFile && !canUploadFromUrl) || uploadLoading"
                  :loading="uploadLoading"
                  variant="flat"
                  @click="importImage(true)"
                >
                  Upload
                </v-btn>
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

              <div v-else-if="!tempImages.length" class="text-medium-emphasis">
                <v-alert type="info" variant="tonal">
                  No temporary images available. Upload one to get started.
                </v-alert>
              </div>

              <v-row v-else dense>
                <v-col cols="12">
                  <div class="d-flex align-center justify-space-between mb-3">
                    <div v-if="canSelectMultiple" class="text-body-2 text-medium-emphasis">
                      Selected temp images: {{ selectedTempImageIds.length }}
                    </div>
                    <div v-else class="text-body-2 text-medium-emphasis">
                      Select one image to assign.
                    </div>
                    <div class="d-flex align-center gap-2">
                      <v-btn
                        v-if="canSelectMultiple"
                        :disabled="!selectedTempImageIds.length || deleteAllLoading"
                        size="small"
                        variant="text"
                        @click="clearTempSelection"
                      >
                        Clear
                      </v-btn>
                      <v-btn
                        color="error"
                        :disabled="!tempImages.length || assignLoading || isGalleryBusy"
                        :loading="deleteAllLoading"
                        size="small"
                        variant="text"
                        @click="deleteAllConfirmVisible = true"
                      >
                        Remove All
                      </v-btn>
                      <v-btn
                        color="primary"
                        :disabled="!entityId || !selectedTempImageIds.length || assignLoading || deleteAllLoading"
                        :loading="assignLoading"
                        size="small"
                        variant="flat"
                        @click="assignSelectedToEntity"
                      >
                        {{ canSelectMultiple ? 'Assign Selected' : 'Assign Image' }}
                      </v-btn>
                    </div>
                  </div>
                  <div v-if="assignSuccess" class="text-success text-body-2 mb-2">
                    Assigned selected image(s).
                  </div>
                  <div v-if="!entityId" class="text-warning text-body-2 mb-2">
                    Save first to assign selected images.
                  </div>
                </v-col>
                <v-col v-for="img in tempImages" :key="img.id" cols="12" lg="3" md="4" sm="6">
                  <v-card
                    :border="isTempSelected(img.id)"
                    class="image-card pa-3 position-relative"
                    :color="isTempSelected(img.id) ? 'primary' : ''"
                    elevation="2"
                    hover
                    @click="toggleTempSelection(img.id)"
                  >
                    <div
                      v-if="backgroundRemovalId === img.id || autoAlignId === img.id || autoCropId === img.id || stackProcessingId === img.id || rotatingId === img.id"
                      class="image-card__busy-overlay"
                    >
                      <v-progress-circular color="primary" indeterminate />
                      <div class="text-caption mt-2">
                        {{ backgroundRemovalId === img.id
                            ? backgroundRemovalLabel
                            : autoAlignId === img.id
                              ? 'Auto aligning...'
                              : autoCropId === img.id
                                ? 'Auto cropping...'
                            : stackProcessingId === img.id
                            ? stackProcessingLabel
                            : rotatingDirection === 'ccw'
                                ? 'Rotating 90 degrees CCW...'
                                : 'Rotating 90 degrees CW...' }}
                      </div>
                    </div>
                    <v-img
                      aspect-ratio="1"
                      class="image-card__preview image-card__preview--checker"
                      contain
                      :src="img.url"
                      width="100%"
                    />

                    <v-card-subtitle class="image-card__date text-caption mt-1 px-2">
                      {{ formatImageDate(img.createdAt) }}
                    </v-card-subtitle>

                    <div class="image-card__actions pb-2 mt-2">
                      <div class="image-card__action-row">
                        <v-btn
                          block
                          color="secondary"
                          :disabled="
                            deleteAllLoading ||
                            backgroundRemovalId === img.id ||
                            autoAlignId === img.id ||
                            autoCropId === img.id ||
                            stackProcessingId === img.id ||
                            rotatingId === img.id ||
                            deletingId === img.id
                          "
                          :loading="rotatingId === img.id && rotatingDirection === 'ccw'"
                          prepend-icon="mdi-rotate-left"
                          size="x-small"
                          title="Rotate 90 degrees counterclockwise"
                          variant="outlined"
                          @click.stop="attemptRotate(img.id, 'ccw')"
                        >
                          90 CCW
                        </v-btn>
                        <v-btn
                          block
                          color="secondary"
                          :disabled="
                            deleteAllLoading ||
                            backgroundRemovalId === img.id ||
                            autoAlignId === img.id ||
                            autoCropId === img.id ||
                            stackProcessingId === img.id ||
                            rotatingId === img.id ||
                            deletingId === img.id
                          "
                          :loading="rotatingId === img.id && rotatingDirection === 'cw'"
                          prepend-icon="mdi-rotate-right"
                          size="x-small"
                          title="Rotate 90 degrees clockwise"
                          variant="outlined"
                          @click.stop="attemptRotate(img.id, 'cw')"
                        >
                          90 CW
                        </v-btn>
                      </div>
                      <div class="image-card__processing-row image-card__indented-action">
                        <button
                          class="image-card__stack-button"
                          :class="{ 'image-card__stack-button--busy': stackProcessingId === img.id }"
                          :disabled="
                            deleteAllLoading ||
                            backgroundRemovalId === img.id ||
                            autoAlignId === img.id ||
                            autoCropId === img.id ||
                            Boolean(stackProcessingId) ||
                            rotatingId === img.id ||
                            deletingId === img.id
                          "
                          title="Run background removal, auto align, and auto crop"
                          type="button"
                          @click.stop="runStackProcess(img.id)"
                        >
                          <v-icon size="12">mdi-auto-fix</v-icon>
                        </button>
                        <div class="image-card__processing-actions">
                          <div class="image-card__split-action">
                            <v-btn
                              block
                              color="secondary"
                              :disabled="
                                deleteAllLoading ||
                                backgroundRemovalId === img.id ||
                                autoAlignId === img.id ||
                                autoCropId === img.id ||
                                stackProcessingId === img.id ||
                                rotatingId === img.id ||
                                deletingId === img.id
                              "
                              :loading="backgroundRemovalId === img.id"
                              prepend-icon="mdi-auto-fix"
                              size="x-small"
                              title="Attempt background removal with IMGLY"
                              variant="outlined"
                              @click.stop="attemptBackgroundRemoval(img.id, 'imgly')"
                            >
                              Remove BG
                            </v-btn>
                            <v-menu location="bottom end">
                              <template #activator="{ props: menuProps }">
                                <v-btn
                                  class="bg-removal-selector"
                                  color="secondary"
                                  :disabled="
                                    deleteAllLoading ||
                                    backgroundRemovalId === img.id ||
                                    autoAlignId === img.id ||
                                    autoCropId === img.id ||
                                    stackProcessingId === img.id ||
                                    rotatingId === img.id ||
                                    deletingId === img.id
                                    "
                                  size="x-small"
                                  title="Choose background removal backend"
                                  v-bind="menuProps"
                                  variant="outlined"
                                  @click.stop
                                >
                                  <v-icon size="12px">mdi-chevron-down</v-icon>
                                </v-btn>
                              </template>
                              <v-list density="compact">
                                <v-list-item
                                  prepend-icon="mdi-auto-fix"
                                  subtitle="Fast local default"
                                  title="Use IMGLY"
                                  @click="attemptBackgroundRemoval(img.id, 'imgly')"
                                />
                                <v-list-item
                                  prepend-icon="mdi-image-outline"
                                  subtitle="CPU-only local fallback via rembg"
                                  title="Use rembg"
                                  @click="attemptBackgroundRemoval(img.id, 'rembg')"
                                />
                              </v-list>
                            </v-menu>
                          </div>
                          <v-btn
                            block
                            color="secondary"
                            :disabled="
                              deleteAllLoading ||
                              backgroundRemovalId === img.id ||
                              autoAlignId === img.id ||
                              autoCropId === img.id ||
                              stackProcessingId === img.id ||
                              rotatingId === img.id ||
                              deletingId === img.id
                            "
                            :loading="autoAlignId === img.id"
                            prepend-icon="mdi-image-filter-center-focus"
                            size="x-small"
                            title="Automatically align the subject horizontally"
                            variant="outlined"
                            @click.stop="attemptAutoAlign(img.id)"
                          >
                            Auto Align
                          </v-btn>
                          <v-btn
                            block
                            color="secondary"
                            :disabled="
                              deleteAllLoading ||
                              backgroundRemovalId === img.id ||
                              autoAlignId === img.id ||
                              autoCropId === img.id ||
                              stackProcessingId === img.id ||
                              rotatingId === img.id ||
                              deletingId === img.id
                            "
                            :loading="autoCropId === img.id"
                            prepend-icon="mdi-crop"
                            size="x-small"
                            title="Auto crop transparent padding"
                            variant="outlined"
                            @click.stop="attemptAutoCrop(img.id)"
                          >
                            Auto Crop
                          </v-btn>
                        </div>
                      </div>
                      <v-btn
                        v-if="!isTempSelected(img.id)"
                        block
                        class="image-card__delete image-card__indented-action"
                        color="error"
                        :disabled="
                          deleteAllLoading ||
                          backgroundRemovalId === img.id ||
                          autoAlignId === img.id ||
                          autoCropId === img.id ||
                          stackProcessingId === img.id ||
                          rotatingId === img.id
                        "
                        :loading="deletingId === img.id"
                        prepend-icon="mdi-delete"
                        size="x-small"
                        title="Delete temporary image"
                        variant="outlined"
                        @click.stop="confirmDeleteImage(img.id)"
                      >
                        Delete
                      </v-btn>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-window-item>

          <v-window-item v-if="showItemGalleryTab" value="item">
            <v-card-text>
              <div v-if="loadingItemGallery" class="d-flex justify-center my-6">
                <v-progress-circular indeterminate />
              </div>

              <div v-else-if="itemGalleryError" class="text-error">{{ itemGalleryError }}</div>

              <div v-else-if="!itemImages.length" class="text-medium-emphasis">
                <v-alert type="info" variant="tonal">
                  No item images found. Upload or assign an image to get started.
                </v-alert>
              </div>

              <v-row v-else dense>
                <v-col cols="12">
                  <div class="d-flex align-center justify-space-between mb-3">
                    <div class="text-body-2 text-medium-emphasis">
                      Item images: {{ itemImages.length }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      Copy an item image to Temp Gallery for editing.
                    </div>
                  </div>
                </v-col>
                <v-col v-for="img in itemImages" :key="img.id" cols="12" lg="3" md="4" sm="6">
                  <v-card class="image-card pa-3 position-relative" elevation="2" hover>
                    <div v-if="itemCopyBusyImageId === img.id" class="image-card__busy-overlay">
                      <v-progress-circular color="primary" indeterminate />
                      <div class="text-caption mt-2">Copying to Temp Gallery...</div>
                    </div>
                    <v-img
                      aspect-ratio="1"
                      class="image-card__preview image-card__preview--checker"
                      contain
                      :src="img.url"
                      width="100%"
                    />

                    <v-card-subtitle class="image-card__date text-caption mt-1 px-2">
                      {{ formatImageDate(img.createdAt) }}
                    </v-card-subtitle>

                    <div class="image-card__actions pb-2 mt-2">
                      <v-btn
                        block
                        color="primary"
                        :disabled="Boolean(itemCopyBusyImageId)"
                        :loading="itemCopyBusyImageId === img.id"
                        prepend-icon="mdi-content-copy"
                        size="x-small"
                        title="Copy image to temp gallery"
                        variant="flat"
                        @click.stop="copyItemImageToTempGallery(img.id)"
                      >
                        Copy To Temp
                      </v-btn>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-window-item>
        </v-window>
      </template>
      <v-card-text v-else class="d-flex justify-center my-8">
        <v-progress-circular indeterminate />
      </v-card-text>
    </v-card>
  </v-dialog>

  <ConfirmDialog
    v-model="deleteConfirmVisible"
    confirm-text="Delete"
    :loading="Boolean(deleteTargetId && deletingId === deleteTargetId)"
    message="This will permanently remove the temporary image."
    title="Delete Temp Image?"
    @confirm="deleteConfirmedImage"
  />

  <ConfirmDialog
    v-model="deleteAllConfirmVisible"
    confirm-text="Remove All"
    :loading="deleteAllLoading"
    message="This will permanently remove every temporary image in the gallery."
    title="Remove All Temp Images?"
    @confirm="deleteAllTempImages"
  />
</template>

<script setup lang="ts">
import type { AxiosError, AxiosProgressEvent } from 'axios';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { usePartStore } from '@/stores/parts_store';

interface ImageData {
  id: string;
  url: string;
  filename?: string;
  createdAt: string;
  status?: 'temp' | 'attached';
}

type BackgroundRemovalBackend = 'imgly' | 'rembg';

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

const props = defineProps<{
  modelValue: boolean;
  entityType?: 'part' | 'tool' | 'customer' | 'supplier' | 'vendor' | 'setup';
  entityId?: string;
  title?: string;
  hasImage?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  'image-selected': [payload: { imageId: string; url: string; isMain?: boolean }];
}>();

const partStore = usePartStore();

const dialog = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

// Tabs
const currentTab = ref<'upload' | 'item' | 'gallery'>('gallery');
const showItemGalleryTab = computed(() => {
  return (props.entityType === 'part' || props.entityType === 'tool') && Boolean(props.entityId);
});

// Upload
const fileInput = ref<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const urlInput = ref('');
const uploadLoading = ref(false);
const uploadError = ref('');
const uploadSuccess = ref(false);
const uploadProgress = ref(0);
const filePreviewUrl = ref<string | null>(null);
const urlPreviewLoaded = ref(false);
const urlPreviewLoading = ref(false);
const urlPreviewError = ref(false);

function getClipboardImageFile(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (!item.type.startsWith('image/')) {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    return file.name
      ? file
      : new File([file], `clipboard-image.${file.type.split('/')[1] ?? 'png'}`, {
          type: file.type,
          lastModified: Date.now(),
        });
  }

  return null;
}

function onFileInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    selectFile(files[0] ?? null);
  }
}

function selectFile(file: File | null) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Please drop an image file.';
    return;
  }

  uploadError.value = '';
  uploadSuccess.value = false;
  urlInput.value = '';
  urlPreviewLoaded.value = false;
  urlPreviewLoading.value = false;
  urlPreviewError.value = false;
  selectedFile.value = file;
}

function onDragEnter() {
  if (uploadLoading.value || !!urlInput.value) return;
  isDragging.value = true;
}

function onDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as Node | null;
  const relatedTarget = event.relatedTarget as Node | null;
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) return;
  isDragging.value = false;
}

function onDragOver() {
  if (uploadLoading.value || !!urlInput.value) return;
  isDragging.value = true;
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  if (uploadLoading.value || !!urlInput.value) return;

  const file = event.dataTransfer?.files?.[0] ?? null;
  selectFile(file);
}

function onPaste(event: ClipboardEvent) {
  if (!dialog.value || currentTab.value !== 'upload' || uploadLoading.value || !!urlInput.value) {
    return;
  }

  const clipboardFile = getClipboardImageFile(event);
  if (!clipboardFile) {
    return;
  }

  event.preventDefault();
  selectFile(clipboardFile);
}

function removeSelectedFile() {
  selectedFile.value = null;
  filePreviewUrl.value = null;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function resetUploadState() {
  selectedFile.value = null;
  isDragging.value = false;
  urlInput.value = '';
  filePreviewUrl.value = null;
  urlPreviewLoaded.value = false;
  urlPreviewLoading.value = false;
  urlPreviewError.value = false;
  uploadError.value = '';
  uploadSuccess.value = false;
  uploadProgress.value = 0;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

async function importImage(attachAfterUpload: boolean) {
  if (selectedFile.value) {
    await uploadFile(attachAfterUpload);
  } else if (urlInput.value) {
    await uploadUrl(attachAfterUpload);
  }
}

async function attachUploadedImage(imageId: string) {
  if (!props.entityId) {
    return;
  }

  const shouldPromoteToMain = props.entityType !== 'part' || !props.hasImage;
  const data =
    props.entityType === 'part'
      ? await partStore.attachTempImageToPart(props.entityId, imageId, shouldPromoteToMain)
      : (
          await api.post(`/images/uploads/${imageId}/attach`, {
            entityType: props.entityType ?? 'part',
            entityId: props.entityId,
            setAsMain: shouldPromoteToMain,
          })
        ).data;

  emit('image-selected', { imageId: data.id, url: data.url, isMain: data.isMain });
  dialog.value = false;
}

// Gallery
const loadingGallery = ref(false);
const galleryError = ref('');
const tempImages = ref<ImageData[]>([]);
const loadingItemGallery = ref(false);
const itemGalleryError = ref('');
const itemImages = ref<MyImageData[]>([]);
const deletingId = ref('');
const backgroundRemovalId = ref('');
const backgroundRemovalBackend = ref<BackgroundRemovalBackend | ''>('');
const autoAlignId = ref('');
const autoCropId = ref('');
const stackProcessingId = ref('');
const stackProcessingStage = ref<0 | 1 | 2 | 3>(0);
const rotatingId = ref('');
const rotatingDirection = ref<'cw' | 'ccw' | ''>('');
const itemCopyBusyImageId = ref('');
const selectedTempImageIds = ref<string[]>([]);
const assignLoading = ref(false);
const assignSuccess = ref(false);
const initializingDialog = ref(false);
const deleteConfirmVisible = ref(false);
const deleteTargetId = ref('');
const deleteAllConfirmVisible = ref(false);
const deleteAllLoading = ref(false);
const canSelectMultiple = computed(() => props.entityType === 'part');
const isGalleryBusy = computed(() => {
  return Boolean(
    deleteAllLoading.value ||
      deletingId.value ||
      backgroundRemovalId.value ||
      autoAlignId.value ||
      autoCropId.value ||
      stackProcessingId.value ||
      rotatingId.value,
  );
});
const stackProcessingLabel = computed(() => {
  if (stackProcessingStage.value === 1) return 'Removing background...';
  if (stackProcessingStage.value === 2) return 'Removing background and aligning...';
  if (stackProcessingStage.value === 3) return 'Removing background, aligning, and cropping...';
  return 'Processing image...';
});
const backgroundRemovalLabel = computed(() => {
  if (backgroundRemovalBackend.value === 'rembg') return 'Removing background with rembg...';
  return 'Removing background...';
});
const isTempSelected = (imageId: string): boolean => {
  return selectedTempImageIds.value.includes(imageId);
};

function toggleTempSelection(imageId: string) {
  if (!canSelectMultiple.value) {
    selectedTempImageIds.value = selectedTempImageIds.value[0] === imageId ? [] : [imageId];
    return;
  }

  if (selectedTempImageIds.value.includes(imageId)) {
    selectedTempImageIds.value = selectedTempImageIds.value.filter((id) => id !== imageId);
    return;
  }

  selectedTempImageIds.value.push(imageId);
}

function clearTempSelection() {
  selectedTempImageIds.value = [];
}

function confirmDeleteImage(imageId: string) {
  deleteTargetId.value = imageId;
  deleteConfirmVisible.value = true;
}

function closeDeleteConfirm() {
  if (deletingId.value) return;
  deleteConfirmVisible.value = false;
  deleteTargetId.value = '';
}

async function deleteConfirmedImage() {
  if (!deleteTargetId.value) return;
  await deleteImage(deleteTargetId.value);
}

function formatImageDate(createdAt: string): string {
  return new Date(createdAt).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function handleImageUploaded() {
  if (dialog.value) {
    loadGallery();
    loadItemGallery();
  }
}

function handleImageDeleted() {
  if (dialog.value) {
    loadGallery();
    loadItemGallery();
  }
}

onMounted(() => {
  socket.on('imageUploaded', handleImageUploaded);
  socket.on('imageDeleted', handleImageDeleted);
  window.addEventListener('paste', onPaste);
});

onBeforeUnmount(() => {
  socket.off('imageUploaded', handleImageUploaded);
  socket.off('imageDeleted', handleImageDeleted);
  window.removeEventListener('paste', onPaste);
});

watch(dialog, (isOpen) => {
  if (isOpen) {
    resetUploadState();
    initializingDialog.value = true;
    loadDialogGalleries(true).finally(() => {
      initializingDialog.value = false;
    });
    return;
  }

  initializingDialog.value = false;
  clearTempSelection();
  assignSuccess.value = false;
  itemCopyBusyImageId.value = '';
  backgroundRemovalId.value = '';
  backgroundRemovalBackend.value = '';
  autoAlignId.value = '';
  autoCropId.value = '';
  stackProcessingId.value = '';
  stackProcessingStage.value = 0;
  deleteConfirmVisible.value = false;
  deleteTargetId.value = '';
  deleteAllConfirmVisible.value = false;
});

watch(
  () => props.entityId,
  () => {
    clearTempSelection();
    assignSuccess.value = false;
    if (dialog.value) {
      loadDialogGalleries();
    }
  },
);

watch(currentTab, (tab) => {
  if (tab === 'upload') {
    resetUploadState();
    galleryError.value = '';
    itemGalleryError.value = '';
    assignSuccess.value = false;
  }
});

async function loadDialogGalleries(selectInitialTab: boolean = false) {
  const [loadedTempImages] = await Promise.all([loadGallery(), loadItemGallery()]);

  if (!selectInitialTab) {
    return;
  }

  if (loadedTempImages.length > 0) {
    currentTab.value = 'gallery';
    return;
  }

  currentTab.value = 'upload';
}

async function loadGallery() {
  loadingGallery.value = true;
  galleryError.value = '';

  try {
    const tempRes = await api.get('/images/uploads/temps');
    tempImages.value = tempRes.data.map((img: ImageData) => ({
      id: img.id,
      url: img.url,
      createdAt: img.createdAt,
      status: 'temp',
    }));
    return tempImages.value;
  } catch (err) {
    galleryError.value = 'Failed to load images';
    console.error(err);
    return [];
  } finally {
    loadingGallery.value = false;
  }
}

async function loadItemGallery() {
  if (!showItemGalleryTab.value || !props.entityId || !props.entityType) {
    itemImages.value = [];
    itemGalleryError.value = '';
    return [];
  }

  loadingItemGallery.value = true;
  itemGalleryError.value = '';

  try {
    const { data } = await api.get<MyImageData[]>(
      `/images/entities/${props.entityType}/${props.entityId}/images`,
    );
    itemImages.value = data;
    return itemImages.value;
  } catch (err) {
    itemGalleryError.value = 'Failed to load item images';
    console.error(err);
    return [];
  } finally {
    loadingItemGallery.value = false;
  }
}

async function uploadFile(attachAfterUpload: boolean) {
  if (!selectedFile.value) return;

  uploadLoading.value = true;
  uploadError.value = '';
  uploadSuccess.value = false;
  uploadProgress.value = 0;
  try {
    const file = selectedFile.value;
    const formData = new FormData();
    formData.append('image', file as Blob);
    const { data } = await api.post('/images/uploads/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent?.lengthComputable) {
          uploadProgress.value = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
          );
        }
      },
    });

    if (attachAfterUpload && props.entityId) {
      await attachUploadedImage(data.id);
    } else {
      uploadSuccess.value = true;
      currentTab.value = 'gallery';
      await loadGallery();
    }

    selectedFile.value = null;
    filePreviewUrl.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
  } catch (err) {
    uploadError.value = 'Failed to upload file';
    console.error(err);
  } finally {
    uploadLoading.value = false;
    uploadProgress.value = 0;
  }
}

async function uploadUrl(attachAfterUpload: boolean) {
  if (!normalizedUrlInput.value) return;

  uploadLoading.value = true;
  uploadError.value = '';
  uploadSuccess.value = false;
  try {
    const { data } = await api.post('/images/uploads/url', { url: normalizedUrlInput.value });

    if (attachAfterUpload && props.entityId) {
      await attachUploadedImage(data.id);
    } else {
      uploadSuccess.value = true;
      currentTab.value = 'gallery';
      await loadGallery();
    }

    urlInput.value = '';
    urlPreviewLoaded.value = false;
    urlPreviewLoading.value = false;
    urlPreviewError.value = false;
  } catch (err) {
    uploadError.value = 'Failed to download and upload image';
    console.error(err);
  } finally {
    uploadLoading.value = false;
  }
}

async function assignSelectedToEntity() {
  if (!props.entityId) {
    galleryError.value = 'Save first to assign selected images.';
    return;
  }
  if (!selectedTempImageIds.value.length) return;

  assignLoading.value = true;
  assignSuccess.value = false;
  galleryError.value = '';

  try {
    let successCount = 0;
    let failCount = 0;
    let firstAssignedImage: { imageId: string; url: string; isMain?: boolean } | null = null;
    let hasMainImage = Boolean(props.hasImage);

    for (const imageId of selectedTempImageIds.value) {
      try {
        const shouldPromoteToMain = props.entityType !== 'part' || !hasMainImage;
        const data =
          props.entityType === 'part'
            ? await partStore.attachTempImageToPart(props.entityId, imageId, shouldPromoteToMain)
            : (
                await api.post(`/images/uploads/${imageId}/attach`, {
                  entityType: props.entityType ?? 'part',
                  entityId: props.entityId,
                  setAsMain: shouldPromoteToMain,
                })
              ).data;
        if (!firstAssignedImage) {
          firstAssignedImage = {
            imageId: data.id,
            url: data.url,
            isMain: data.isMain,
          };
        }
        if (data.isMain) {
          hasMainImage = true;
        }
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }

    if (successCount > 0) {
      assignSuccess.value = true;
      if (firstAssignedImage) {
        emit('image-selected', firstAssignedImage);
      }
      dialog.value = false;
    }
    if (failCount > 0) {
      galleryError.value = `${failCount} image(s) failed to assign.`;
    }

    clearTempSelection();
    await loadGallery();
  } catch (err) {
    galleryError.value = 'Failed to assign selected images.';
    console.error('Failed assigning selected temp images:', err);
  } finally {
    assignLoading.value = false;
  }
}

async function copyItemImageToTemp(imageId: string) {
  if (!props.entityId || !props.entityType) {
    throw new Error('Missing entity context');
  }

  const { data } = await api.post<MyImageData>(
    `/images/entities/${props.entityType}/${props.entityId}/images/${imageId}/copy-to-temp`,
  );
  return data;
}

async function copyItemImageToTempGallery(imageId: string) {
  if (!imageId || itemCopyBusyImageId.value) return;

  itemCopyBusyImageId.value = imageId;
  itemGalleryError.value = '';

  try {
    await copyItemImageToTemp(imageId);

    await loadGallery();
    currentTab.value = 'gallery';
  } catch (err: unknown) {
    itemGalleryError.value = getErrorMessage(err, 'Failed to copy image to temp gallery.');
    console.error('Failed copying item image to temp gallery:', err);
  } finally {
    itemCopyBusyImageId.value = '';
  }
}

async function attemptBackgroundRemoval(
  imageId: string,
  backend: BackgroundRemovalBackend = 'imgly',
) {
  if (
    !imageId ||
    backgroundRemovalId.value ||
    autoAlignId.value ||
    autoCropId.value ||
    stackProcessingId.value ||
    rotatingId.value
  )
    return;

  backgroundRemovalId.value = imageId;
  backgroundRemovalBackend.value = backend;
  galleryError.value = '';

  try {
    await api.post(`/images/uploads/${imageId}/remove-background`, {
      backend,
      model: backend === 'imgly' ? 'large' : undefined,
    });
    await loadGallery();
  } catch (err: unknown) {
    galleryError.value = getErrorMessage(err, 'Failed to remove the image background.');
    console.error('Failed background removal:', err);
  } finally {
    backgroundRemovalId.value = '';
    backgroundRemovalBackend.value = '';
  }
}

async function attemptAutoAlign(imageId: string) {
  if (
    !imageId ||
    backgroundRemovalId.value ||
    autoAlignId.value ||
    autoCropId.value ||
    stackProcessingId.value ||
    rotatingId.value
  )
    return;

  autoAlignId.value = imageId;
  galleryError.value = '';

  try {
    await api.post(`/images/uploads/${imageId}/auto-align`);
    await loadGallery();
  } catch (err: unknown) {
    galleryError.value = getErrorMessage(err, 'Failed to auto align the image.');
    console.error('Failed auto align:', err);
  } finally {
    autoAlignId.value = '';
  }
}

async function attemptAutoCrop(imageId: string) {
  if (
    !imageId ||
    backgroundRemovalId.value ||
    autoAlignId.value ||
    autoCropId.value ||
    stackProcessingId.value ||
    rotatingId.value
  )
    return;

  autoCropId.value = imageId;
  galleryError.value = '';

  try {
    await api.post(`/images/uploads/${imageId}/auto-crop`);
    await loadGallery();
  } catch (err: unknown) {
    galleryError.value = getErrorMessage(err, 'Failed to auto crop the image.');
    console.error('Failed auto crop:', err);
  } finally {
    autoCropId.value = '';
  }
}

async function runStackProcess(imageId: string) {
  if (!imageId || stackProcessingId.value || rotatingId.value) return;

  const stage = 3;
  stackProcessingId.value = imageId;
  stackProcessingStage.value = stage;
  galleryError.value = '';

  try {
    await api.post(`/images/uploads/${imageId}/process-stack`, { stage });
    await loadGallery();
  } catch (err: unknown) {
    galleryError.value = getErrorMessage(err, 'Failed to process image.');
    console.error('Failed staged image processing:', err);
  } finally {
    stackProcessingId.value = '';
    stackProcessingStage.value = 0;
  }
}

async function attemptRotate(imageId: string, direction: 'cw' | 'ccw') {
  if (!imageId || stackProcessingId.value || rotatingId.value) return;

  rotatingId.value = imageId;
  rotatingDirection.value = direction;
  galleryError.value = '';

  try {
    await api.post(`/images/uploads/${imageId}/rotate`, { direction });
    await loadGallery();
  } catch (err: unknown) {
    galleryError.value = getErrorMessage(err, 'Failed to rotate the image.');
    console.error('Failed rotate:', err);
  } finally {
    rotatingId.value = '';
    rotatingDirection.value = '';
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return (
    axiosError.response?.data?.error ||
    axiosError.response?.data?.message ||
    axiosError.message ||
    fallback
  );
}

async function deleteImage(imageId: string) {
  deletingId.value = imageId;

  try {
    await api.delete(`/images/uploads/${imageId}`);
    tempImages.value = tempImages.value.filter((img) => img.id !== imageId);
    clearTempSelection();
    deleteConfirmVisible.value = false;
    deleteTargetId.value = '';
  } catch (err) {
    galleryError.value = 'Failed to delete image.';
    console.error('Failed to delete image:', err);
  } finally {
    deletingId.value = '';
  }
}

async function deleteAllTempImages() {
  if (!tempImages.value.length || deleteAllLoading.value) return;

  deleteAllLoading.value = true;
  galleryError.value = '';

  try {
    await api.delete('/images/uploads');
    tempImages.value = [];
    clearTempSelection();
    deleteAllConfirmVisible.value = false;
  } catch (err) {
    galleryError.value = 'Failed to delete temp images.';
    console.error('Failed to delete temp images:', err);
  } finally {
    deleteAllLoading.value = false;
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

const normalizedUrlInput = computed(() => urlInput.value.trim());

const validImageUrl = computed(() => {
  if (!normalizedUrlInput.value) return false;
  try {
    const url = new URL(normalizedUrlInput.value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
});

const canUploadFromUrl = computed(() => validImageUrl.value && urlPreviewLoaded.value);

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

watch(urlInput, () => {
  urlPreviewLoaded.value = false;
  urlPreviewLoading.value = validImageUrl.value;
  urlPreviewError.value = false;
});

function onUrlClear() {
  urlInput.value = '';
  urlPreviewLoaded.value = false;
  urlPreviewLoading.value = false;
  urlPreviewError.value = false;
  uploadError.value = '';
}

function onUrlPreviewLoad() {
  urlPreviewLoaded.value = true;
  urlPreviewLoading.value = false;
  urlPreviewError.value = false;
}

function onUrlPreviewError() {
  urlPreviewLoaded.value = false;
  urlPreviewLoading.value = false;
  urlPreviewError.value = Boolean(normalizedUrlInput.value);
}
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
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}
.upload-drop-area {
  width: 100%;
  max-width: 500px;
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

.upload-drop-area--active {
  border-color: #1976d2;
  background: #eaf2fd;
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
  max-width: 500px;
}
.upload-file-preview {
  width: 100%;
  max-width: 560px;
  height: min(34vh, 300px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.upload-url-preview {
  width: 100%;
  max-width: 560px;
  max-height: min(24vh, 220px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  overflow: hidden;
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
}
.image-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.image-card__busy-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 253, 0.88);
  border-radius: 12px;
  text-align: center;
}

.image-card__date {
  line-height: 1.25;
  white-space: normal;
}

.image-card__preview {
  width: 100%;
  background-repeat: repeat;
  background-position: 0 0;
}

.image-card__preview--checker {
  background-color: #f6f8fa;
  background-image:
    linear-gradient(45deg, rgba(148, 163, 184, 0.16) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.16) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.16) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.16) 75%);
  background-size: 18px 18px;
  background-position:
    0 0,
    0 9px,
    9px -9px,
    -9px 0;
}

.image-card__actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: stretch;
  padding-inline: 0.45rem;
}

.image-card__action-row {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}

.image-card__indented-action {
  margin-inline: 0;
}

.image-card__processing-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 0.4rem;
  align-items: stretch;
}

.image-card__processing-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.image-card__split-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.35rem;
  align-items: stretch;
}

.image-card__stack-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
  padding: 0.45rem 0.25rem;
  border: 1px solid #90caf9;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, #edf5ff 0%, #d9ebff 100%);
  color: #0d47a1;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.image-card__stack-button:hover:not(:disabled) {
  border-color: #1976d2;
  box-shadow: 0 4px 10px rgba(25, 118, 210, 0.16);
}

.image-card__stack-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.image-card__stack-button--busy {
  border-color: #1976d2;
}

.image-card__stack-label {
  margin-top: 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.image-card__stack-subtitle {
  margin-top: 0.18rem;
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  width: auto;
  max-height: min(22vh, 200px);
  object-fit: contain;
}

.upload-file-img-preview {
  max-width: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bg-removal-selector {
  width: 20px;
  min-width: 20px;
  max-width: 20px;
  padding-inline: 0;
}
</style>
