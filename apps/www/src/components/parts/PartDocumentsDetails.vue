<template>
  <div class="part-documents-details">
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h3 class="text-h6">Part Documents</h3>
        <p class="text-medium-emphasis text-body-2">{{ documentCountLabel }}</p>
      </div>

      <div class="d-flex align-center ga-2">
        <input ref="fileInput" class="d-none" type="file" @change="onFileSelected" />
        <v-btn
          color="primary"
          :disabled="!part._id || uploading"
          :loading="uploading"
          prepend-icon="mdi-file-upload-outline"
          variant="elevated"
          @click="openFilePicker"
        >
          Add Document
        </v-btn>
      </div>
    </div>

    <v-alert v-if="!part._id" type="info" variant="tonal">
      Save this part first, then you can upload and manage documents.
    </v-alert>

    <v-card v-else>
      <v-card-text>
        <div v-if="loading" class="d-flex justify-center my-6">
          <v-progress-circular indeterminate />
        </div>

        <div v-else-if="error" class="text-error">{{ error }}</div>

        <div v-else-if="!documents.length" class="text-medium-emphasis py-4">
          No documents yet. Click <strong>Add Document</strong> to upload a PDF or text file.
        </div>

        <div v-else class="documents-list">
          <v-card
            v-for="document in documents"
            :key="document.id"
            class="document-card"
            variant="outlined"
          >
            <div class="document-card__meta">
              <div class="d-flex align-center ga-3 min-w-0">
                <v-icon :icon="getDocumentIcon(document)" size="28" />
                <div class="min-w-0">
                  <div class="document-card__title text-truncate">
                    {{ document.originalName || document.filename }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ formatDocumentSubtitle(document) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="document-card__actions">
              <v-btn
                prepend-icon="mdi-open-in-new"
                size="small"
                variant="tonal"
                @click="viewDocument(document)"
              >
                Open
              </v-btn>
              <v-btn
                download
                :href="document.url"
                prepend-icon="mdi-download"
                size="small"
                variant="text"
              >
                Download
              </v-btn>
              <v-btn
                color="error"
                icon="mdi-delete"
                :loading="deletingId === document.id"
                size="small"
                variant="outlined"
                @click="confirmDeleteDocument(document)"
              />
            </div>
          </v-card>
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="viewerOpen" fullscreen>
      <v-card class="document-viewer">
        <v-toolbar color="black" density="comfortable" theme="dark">
          <v-toolbar-title
            >{{ viewerDocument?.originalName || 'Document Preview' }}</v-toolbar-title
          >
          <v-spacer />
          <v-btn
            v-if="viewerDocument"
            download
            :href="viewerDocument.url"
            icon="mdi-download"
            variant="text"
          />
          <v-btn icon="mdi-close" variant="text" @click="closeViewer" />
        </v-toolbar>

        <v-card-text class="document-viewer__content pa-0">
          <div v-if="viewerLoading" class="d-flex justify-center align-center fill-height">
            <v-progress-circular indeterminate />
          </div>

          <iframe
            v-else-if="viewerMode === 'pdf' && viewerDocument"
            class="document-viewer__frame"
            :src="viewerDocument.url"
            title="PDF preview"
          />

          <pre
            v-else-if="viewerMode === 'text'"
            class="document-viewer__text"
          >{{ viewerText }}</pre>

          <div v-else class="document-viewer__fallback">
            <v-btn
              v-if="viewerDocument"
              :href="viewerDocument.url"
              prepend-icon="mdi-open-in-new"
              target="_blank"
              variant="elevated"
            >
              Open Document
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="deleteConfirmVisible"
      confirm-text="Delete"
      :loading="Boolean(deleteTarget && deletingId === deleteTarget.id)"
      title="Delete Document?"
      @confirm="deleteConfirmedDocument"
    >
      This will permanently remove the document from this part.
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { usePartStore } from '@/stores/parts_store';

const props = defineProps<{
  part: Part;
}>();

const partStore = usePartStore();

const fileInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const uploading = ref(false);
const error = ref('');
const documents = ref<MyDocumentData[]>([]);
const deletingId = ref('');
const deleteConfirmVisible = ref(false);
const deleteTarget = ref<MyDocumentData | null>(null);

const viewerOpen = ref(false);
const viewerLoading = ref(false);
const viewerMode = ref<'pdf' | 'text' | 'external'>('external');
const viewerDocument = ref<MyDocumentData | null>(null);
const viewerText = ref('');

const documentCountLabel = computed(() => {
  const count = documents.value.length;
  return count === 1 ? '1 document' : `${count} documents`;
});

function openFilePicker() {
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !props.part._id) return;

  uploading.value = true;
  error.value = '';

  try {
    await partStore.uploadPartDocument(props.part._id, file);
    toastSuccess('Document uploaded successfully');
    documents.value = partStore.getPartDocuments(props.part._id);
  } catch (err) {
    error.value = 'Failed to upload document.';
    console.error(err);
    toastError('Failed to upload document');
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

function getDocumentIcon(document: MyDocumentData) {
  if (isPdf(document)) return 'mdi-file-pdf-box';
  if (isTextDocument(document)) return 'mdi-file-document-outline';
  return 'mdi-file-outline';
}

function formatDocumentSubtitle(document: MyDocumentData) {
  return `${formatBytes(document.size)} • ${new Date(document.createdAt).toLocaleString()}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(document: MyDocumentData) {
  return (
    document.mimeType === 'application/pdf' ||
    document.extension?.toLowerCase() === '.pdf' ||
    document.originalName.toLowerCase().endsWith('.pdf')
  );
}

function isTextDocument(document: MyDocumentData) {
  const textExtensions = ['.txt', '.csv', '.log', '.md', '.tap', '.nc', '.gcode', '.dxf'];
  const extension = document.extension?.toLowerCase() || '';
  return (
    document.mimeType?.startsWith('text/') === true ||
    textExtensions.includes(extension) ||
    textExtensions.some((ext) => document.originalName.toLowerCase().endsWith(ext))
  );
}

async function viewDocument(document: MyDocumentData) {
  viewerDocument.value = document;
  viewerText.value = '';

  if (isPdf(document)) {
    viewerMode.value = 'pdf';
    viewerOpen.value = true;
    return;
  }

  if (isTextDocument(document)) {
    viewerMode.value = 'text';
    viewerLoading.value = true;
    viewerOpen.value = true;

    try {
      const response = await fetch(document.url);
      viewerText.value = await response.text();
    } catch (err) {
      console.error(err);
      viewerMode.value = 'external';
      toastError('Failed to load text preview');
    } finally {
      viewerLoading.value = false;
    }
    return;
  }

  window.open(document.url, '_blank', 'noopener');
}

function closeViewer() {
  viewerOpen.value = false;
  viewerLoading.value = false;
  viewerText.value = '';
  viewerDocument.value = null;
  viewerMode.value = 'external';
}

function confirmDeleteDocument(document: MyDocumentData) {
  deleteTarget.value = document;
  deleteConfirmVisible.value = true;
}

async function deleteConfirmedDocument() {
  if (!deleteTarget.value || !props.part._id) return;

  deletingId.value = deleteTarget.value.id;
  error.value = '';

  try {
    await partStore.deletePartDocument(props.part._id, deleteTarget.value.id);
    toastSuccess('Document deleted successfully');
    deleteConfirmVisible.value = false;
    deleteTarget.value = null;
    documents.value = partStore.getPartDocuments(props.part._id);
  } catch (err) {
    error.value = 'Failed to delete document.';
    console.error(err);
    toastError('Failed to delete document');
  } finally {
    deletingId.value = '';
  }
}

async function loadDocuments() {
  if (!props.part._id) {
    documents.value = [];
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    documents.value = await partStore.loadPartDocuments(props.part._id);
  } catch (err) {
    error.value = 'Failed to load documents.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.part._id,
  () => {
    loadDocuments();
  },
  { immediate: true },
);
</script>

<style scoped>
.documents-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.document-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.document-card__meta {
  min-width: 0;
  flex: 1;
}

.document-card__title {
  font-weight: 600;
}

.document-card__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.document-viewer {
  background: #0e0e0e;
}

.document-viewer__content {
  height: calc(100dvh - 64px);
  background: #111;
}

.document-viewer__frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
}

.document-viewer__text {
  height: 100%;
  margin: 0;
  padding: 1rem;
  overflow: auto;
  color: #f3f3f3;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
}

.document-viewer__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
