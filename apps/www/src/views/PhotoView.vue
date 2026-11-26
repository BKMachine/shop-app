<template>
  <div class="photo-page">
    <header class="photo-header">
      <v-btn
        aria-label="Home"
        density="comfortable"
        icon="mdi-home-outline"
        :to="{ name: 'home' }"
        variant="text"
      />
      <h1 class="photo-title">Photo</h1>
    </header>

    <!-- Camera opens straight to the rear camera on phones; library opens Photos. -->
    <input
      ref="cameraInput"
      accept="image/*"
      capture="environment"
      class="d-none"
      type="file"
      @change="onFileChosen"
    />
    <input ref="libraryInput" accept="image/*" class="d-none" type="file" @change="onFileChosen" />

    <main class="photo-main">
      <div v-if="preparing" class="photo-empty">
        <v-progress-circular color="primary" indeterminate size="48" />
      </div>

      <button
        v-else-if="!photo"
        class="photo-empty photo-empty--tap"
        type="button"
        @click="cameraInput?.click()"
      >
        <v-icon icon="mdi-camera-outline" size="64" />
        <span class="photo-empty-title">Tap to take a photo</span>
        <span class="photo-hint">Then upload it or print it on a shop printer.</span>
      </button>

      <figure v-else class="photo-preview">
        <img alt="Ready to upload or print" :src="previewUrl" />
        <figcaption class="photo-hint">Taken {{ photo.timestamp }}</figcaption>
      </figure>
    </main>

    <p
      v-if="statusMessage"
      :class="['photo-status', { 'photo-status--error': statusIsError }]"
      role="status"
    >
      {{ statusMessage }}
    </p>

    <!-- Bottom bar: within thumb reach, and on the right when the phone is sideways. -->
    <nav class="photo-bar">
      <template v-if="!photo">
        <v-btn
          class="bar-button"
          :disabled="preparing"
          prepend-icon="mdi-image-multiple-outline"
          stacked
          variant="tonal"
          @click="libraryInput?.click()"
        >
          Library
        </v-btn>
        <v-btn
          class="bar-button"
          color="primary"
          :disabled="preparing"
          prepend-icon="mdi-camera"
          stacked
          variant="flat"
          @click="cameraInput?.click()"
        >
          Camera
        </v-btn>
      </template>

      <template v-else>
        <v-btn
          class="bar-button"
          :disabled="busy"
          prepend-icon="mdi-camera-retake-outline"
          stacked
          variant="text"
          @click="reset"
        >
          Retake
        </v-btn>
        <v-btn
          class="bar-button"
          :disabled="busy"
          :loading="printing"
          prepend-icon="mdi-printer-outline"
          stacked
          variant="tonal"
          @click="openPrintDialog"
        >
          Print
        </v-btn>
        <v-btn
          class="bar-button"
          color="primary"
          :disabled="busy"
          :loading="uploading"
          prepend-icon="mdi-cloud-upload-outline"
          stacked
          variant="flat"
          @click="uploadOnly"
        >
          Upload
        </v-btn>
      </template>
    </nav>

    <v-bottom-sheet v-model="printDialog" inset max-width="600">
      <v-card class="print-sheet">
        <v-card-title class="print-sheet-title">Print photo</v-card-title>
        <v-card-text class="print-sheet-body">
          <v-progress-linear v-if="loadingPrinters" color="primary" indeterminate />
          <p v-else-if="printersError" class="photo-status--error">{{ printersError }}</p>

          <v-select
            v-if="printers.length"
            v-model="selectedPrinterId"
            hide-details
            item-title="name"
            item-value="_id"
            :items="printers"
            label="Printer"
            prepend-inner-icon="mdi-printer-outline"
          />
          <v-textarea
            v-model="caption"
            auto-grow
            counter="200"
            label="Caption (optional)"
            :maxlength="200"
            rows="2"
          />
          <v-checkbox
            v-model="alsoUpload"
            density="compact"
            hide-details
            label="Also upload to server"
          />
          <p class="photo-hint">
            Prints fit to the page, with the time the photo was taken in the corner.
          </p>
        </v-card-text>
        <div class="print-sheet-actions">
          <v-btn size="large" variant="text" @click="printDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!selectedPrinter"
            prepend-icon="mdi-printer-outline"
            size="large"
            variant="flat"
            @click="print"
          >
            Print
          </v-btn>
        </div>
      </v-card>
    </v-bottom-sheet>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type PreparedPhoto, preparePhoto } from '@/lib/photoPrint';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

const LAST_PRINTER_KEY = 'photo-last-printer';
const UPLOAD_WITH_PRINT_KEY = 'photo-upload-with-print';

const cameraInput = ref<HTMLInputElement | null>(null);
const libraryInput = ref<HTMLInputElement | null>(null);

const photo = ref<PreparedPhoto | null>(null);
const previewUrl = ref('');
const preparing = ref(false);
const uploading = ref(false);
const printing = ref(false);
const statusMessage = ref('');
const statusIsError = ref(false);

const printDialog = ref(false);
const printers = ref<Printer[]>([]);
const loadingPrinters = ref(false);
const printersError = ref('');
const selectedPrinterId = ref<string | null>(readStorage(LAST_PRINTER_KEY));
const caption = ref('');
const alsoUpload = ref(readStorage(UPLOAD_WITH_PRINT_KEY) === 'true');

const busy = computed(() => uploading.value || printing.value);
const selectedPrinter = computed(() =>
  printers.value.find((printer) => printer._id === selectedPrinterId.value),
);

watch(selectedPrinterId, (id) => {
  if (id) writeStorage(LAST_PRINTER_KEY, id);
});
watch(alsoUpload, (value) => writeStorage(UPLOAD_WITH_PRINT_KEY, String(value)));

onBeforeUnmount(clearPreview);

// On Android Chrome the keyboard normally covers the page instead of shrinking it,
// which would hide the caption field in the print sheet. Ask for the page to be
// resized instead, on this page only. Other browsers ignore the setting.
const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
const originalViewport = viewportMeta?.content ?? '';
onMounted(() => {
  if (viewportMeta && !originalViewport.includes('interactive-widget')) {
    viewportMeta.content = `${originalViewport}, interactive-widget=resizes-content`;
  }
});
onBeforeUnmount(() => {
  if (viewportMeta) viewportMeta.content = originalViewport;
});

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // so picking the same file again still fires change
  if (!file) return;

  preparing.value = true;
  setStatus('');
  try {
    const prepared = await preparePhoto(file);
    clearPreview();
    photo.value = prepared;
    previewUrl.value = URL.createObjectURL(prepared.printBlob);
  } catch (error) {
    setStatus(errorMessage(error, 'This photo could not be read.'), true);
  } finally {
    preparing.value = false;
  }
}

function reset() {
  clearPreview();
  photo.value = null;
  caption.value = '';
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}

async function openPrintDialog() {
  printDialog.value = true;
  loadingPrinters.value = true;
  printersError.value = '';
  try {
    // Same list as the Android app: printers switched on for the phone apps.
    const { data } = await api.get<Printer[]>('/printers');
    printers.value = data.filter((printer) => printer.showInAndroid);
    if (!printers.value.some((printer) => printer._id === selectedPrinterId.value)) {
      selectedPrinterId.value = printers.value[0]?._id ?? null;
    }
    if (!printers.value.length) {
      printersError.value = 'No printers are set up for phones. Add one under Settings > Printers.';
    }
  } catch (error) {
    printersError.value = errorMessage(error, 'Could not load printers.');
  } finally {
    loadingPrinters.value = false;
  }
}

async function print() {
  const current = photo.value;
  const printer = selectedPrinter.value;
  if (!current || !printer) return;

  printDialog.value = false;
  printing.value = true;
  setStatus(`Printing on ${printer.name}...`);

  const form = new FormData();
  form.append('timestamp', current.timestamp);
  if (caption.value.trim()) form.append('caption', caption.value.trim());
  form.append('image', current.printBlob, 'photo.jpg');

  const shouldUpload = alsoUpload.value;
  const uploadRequest = shouldUpload ? upload(current) : Promise.resolve(true);

  try {
    await api.post(`/printers/${printer._id}/print`, form);
    toastSuccess(`Sent to ${printer.name}`);
    setStatus(`Sent to ${printer.name}`);
  } catch (error) {
    setStatus(`Print failed: ${errorMessage(error, 'unknown error')}`, true);
    toastError('Print failed');
  } finally {
    printing.value = false;
  }

  // Like the Android app, a successful upload clears the photo.
  if (shouldUpload && (await uploadRequest) && !statusIsError.value) reset();
}

async function uploadOnly() {
  if (!photo.value) return;
  if (await upload(photo.value)) reset();
}

async function upload(current: PreparedPhoto): Promise<boolean> {
  uploading.value = true;
  try {
    const form = new FormData();
    form.append('image', current.uploadBlob, current.uploadName);
    await api.post('/images/uploads/file', form);
    toastSuccess('Photo uploaded');
    return true;
  } catch (error) {
    setStatus(`Upload failed: ${errorMessage(error, 'unknown error')}`, true);
    toastError('Upload failed');
    return false;
  } finally {
    uploading.value = false;
  }
}

function setStatus(message: string, isError = false) {
  statusMessage.value = message;
  statusIsError.value = isError;
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    if (data?.error || data?.message) return data.error || data.message || fallback;
    // No message from the server: the phone couldn't reach it, or a proxy answered.
    if (!error.response) return 'Could not reach the server. Check the phone is on the shop Wi-Fi.';
    return `${fallback} (server error ${error.response.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

// Storage can be unavailable (private browsing); the page works without it.
function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
</script>

<style scoped>
/*
 * Phone-first, one screen with no page scroll: header, photo area that takes the
 * rest, and an action bar at the bottom. On a sideways phone the bar moves to the
 * right so the photo keeps the height.
 */
.photo-page {
  display: grid;
  grid-template-areas:
    "header"
    "main"
    "status"
    "bar";
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100dvh;
  max-width: 640px;
  margin: 0 auto;
  overflow: hidden;
}

.photo-header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: max(4px, env(safe-area-inset-top)) 12px 0 max(8px, env(safe-area-inset-left));
}

.photo-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.photo-main {
  grid-area: main;
  display: flex;
  min-height: 0;
  padding: 8px max(16px, env(safe-area-inset-left)) 8px max(16px, env(safe-area-inset-right));
}

.photo-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 0;
  padding: 16px;
  text-align: center;
}

.photo-empty--tap {
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 16px;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  cursor: pointer;
}

.photo-empty--tap:active {
  background: rgba(var(--v-theme-primary), 0.08);
}

.photo-empty-title {
  font-size: 1.125rem;
  font-weight: 600;
}

.photo-preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 0;
  margin: 0;
}

.photo-preview img {
  flex: 1;
  width: 100%;
  min-height: 0;
  object-fit: contain;
}

.photo-hint {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
  text-align: center;
}

.photo-status {
  grid-area: status;
  margin: 0;
  padding: 0 16px;
  font-size: 0.875rem;
  text-align: center;
}

.photo-status--error {
  color: rgb(var(--v-theme-error));
}

.photo-bar {
  grid-area: bar;
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 8px;
  padding: 8px max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
}

/* Scoped to the bar so it outranks Vuetify's own button height. */
.photo-bar .bar-button {
  min-width: 0;
  height: 64px;
  padding: 0 4px;
}

/* Sideways phones: bar on the right, full height. */
@media (orientation: landscape) and (max-height: 540px) {
  .photo-page {
    grid-template-areas:
      "header bar"
      "main bar"
      "status bar";
    grid-template-columns: minmax(0, 1fr) 112px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    max-width: none;
  }

  .photo-bar {
    grid-auto-flow: row;
    grid-auto-rows: minmax(0, 1fr);
    padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
      max(8px, env(safe-area-inset-bottom)) 0;
  }

  .photo-bar .bar-button {
    height: 100%;
    min-height: 56px;
  }
}

.print-sheet {
  padding-bottom: env(safe-area-inset-bottom);
}

.print-sheet-title {
  padding-top: 16px;
}

.print-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 70dvh;
  overflow-y: auto;
}

.print-sheet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 16px 16px;
}
</style>
