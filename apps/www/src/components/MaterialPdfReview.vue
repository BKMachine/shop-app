<template>
  <v-container class="py-4" fluid>
    <v-card v-if="!pdfBlobUrl" class="mb-4">
      <v-card-title>Material Purchase Acknowledgment PDF</v-card-title>
      <v-card-text>
        <div
          class="drop-zone"
          :class="{ 'drop-zone--active': isDragging, 'drop-zone--loading': uploading }"
          @click="openFilePicker"
          @dragenter.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @dragover.prevent="isDragging = true"
          @drop.prevent="onDrop"
        >
          <div class="text-subtitle-1">Drop PDF here</div>
          <div class="text-body-2 mt-1">or click to browse</div>
        </div>
        <input
          ref="fileInput"
          accept="application/pdf,.pdf"
          class="d-none"
          type="file"
          @change="onFileChange"
        />
        <v-progress-linear v-if="uploading" class="mt-4" indeterminate />
        <v-alert v-if="error" class="mt-4" type="error" variant="tonal">{{ error }}</v-alert>
      </v-card-text>
    </v-card>

    <v-row v-if="pdfBlobUrl">
      <v-col cols="12" md="7">
        <v-card style="height: 100%;" variant="outlined">
          <v-card-title class="d-flex align-center py-2 text-body-1">
            <v-icon class="mr-2" size="20">mdi-file-pdf-box</v-icon>
            {{ fileName }}
            <v-spacer />
            <v-btn
              density="compact"
              prepend-icon="mdi-upload"
              size="small"
              variant="text"
              @click="reset"
            >
              Upload another
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-0">
            <!-- eslint-disable-next-line vuejs-accessibility/no-distracting-elements -->
            <object
              :aria-label="fileName"
              class="pdf-embed"
              :data="pdfBlobUrl"
              title="PDF preview"
              type="application/pdf"
            >
              <div class="pa-6 text-center">
                <p class="text-body-2 mb-3">PDF preview not available in this browser.</p>
                <v-btn :href="pdfBlobUrl" prepend-icon="mdi-open-in-new" target="_blank">
                  Open PDF
                </v-btn>
              </div>
            </object>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-progress-linear v-if="uploading" class="mb-3" indeterminate />
        <v-alert v-if="error" class="mb-3" type="error" variant="tonal">{{ error }}</v-alert>

        <div
          v-if="!uploading && previews.length === 0"
          class="text-body-2 text-medium-emphasis pa-2"
        >
          No recognized materials found in this PDF.
        </div>

        <v-card v-for="(result, index) in previews" :key="index" class="mb-4" variant="outlined">
          <div :style="{ height: '4px', background: resultColor(index) }" />

          <v-card-title class="text-subtitle-1 pt-3"> {{ materialTitle(result) }} </v-card-title>

          <v-card-text>
            <div class="parsed-lines mb-3">
              <div
                v-for="(entry, li) in lineEntries(result)"
                :key="li"
                class="parsed-line-row mb-1"
              >
                <span class="line-label text-caption text-medium-emphasis mr-1"
                  >{{ entry.label }}:</span
                >
                <code class="text-caption line-value">
                  <template
                    v-for="(seg, si) in segmentLine(entry.line, entry.highlights)"
                    :key="si"
                  >
                    <mark
                      v-if="seg.label"
                      :style="{ background: fieldColor(seg.label), color: 'inherit', borderRadius: '2px', padding: '0 2px' }"
                      :title="seg.label"
                      >{{ seg.text }}</mark
                    >
                    <span v-else>{{ seg.text }}</span>
                  </template>
                </code>
              </div>
            </div>

            <v-divider class="mb-3" />

            <div v-if="result.parsed.unitType === 'lb'" class="cost-math text-caption mb-3">
              <span class="text-medium-emphasis">{{ formatNum(result.parsed.weight) }} lbs</span>
              <span class="mx-1">×</span>
              <span class="text-medium-emphasis">{{ formatMoney(result.parsed.rate) }}/lb</span>
              <span class="mx-1">=</span>
              <span class="text-medium-emphasis"
                >{{ formatMoney(result.parsed.weight * result.parsed.rate) }}
                total</span
              >
              <span class="mx-1">÷</span>
              <span class="text-medium-emphasis">{{ formatNum(result.parsed.feet) }} ft</span>
              <span class="mx-1">=</span>
              <strong>{{ formatMoney(result.proposedCostPerFoot) }}/ft</strong>
            </div>
            <div v-else-if="result.parsed.unitType === 'ea'" class="cost-math text-caption mb-3">
              <span class="text-medium-emphasis">{{ formatMoney(result.parsed.rate) }}/bar</span>
              <span class="mx-1">÷</span>
              <span class="text-medium-emphasis">{{ formatNum(result.parsed.feet) }} ft</span>
              <span class="mx-1">=</span>
              <strong>{{ formatMoney(result.proposedCostPerFoot) }}/ft</strong>
            </div>

            <div class="d-flex align-center" style="gap: 16px;">
              <div>
                <div class="text-caption text-medium-emphasis">Current ($/ft)</div>
                <div class="text-body-2">{{ formatMoney(result.currentCostPerFoot) }}</div>
              </div>
              <v-icon size="small">mdi-arrow-right</v-icon>
              <div>
                <div class="text-caption text-medium-emphasis">Proposed ($/ft)</div>
                <div class="text-body-2 font-weight-bold">
                  {{ formatMoney(result.proposedCostPerFoot) }}
                </div>
              </div>
            </div>

            <v-alert
              v-if="!result.existingMaterial"
              class="mt-3"
              density="compact"
              type="warning"
              variant="tonal"
            >
              No matching material in database.
            </v-alert>
            <v-alert
              v-else-if="decisions[index] === 'applied'"
              class="mt-3"
              density="compact"
              type="success"
              variant="tonal"
            >
              Cost updated.
            </v-alert>
            <v-alert
              v-else-if="decisions[index] === 'rejected'"
              class="mt-3"
              density="compact"
              type="info"
              variant="tonal"
            >
              Change rejected.
            </v-alert>
            <v-alert
              v-else-if="!result.hasCostChange"
              class="mt-3"
              density="compact"
              type="info"
              variant="tonal"
            >
              Cost is already up to date.
            </v-alert>
          </v-card-text>

          <v-card-actions
            v-if="result.existingMaterial && result.hasCostChange && !decisions[index]"
          >
            <v-spacer />
            <v-btn
              color="red"
              :disabled="decisionLoading[index]"
              variant="outlined"
              @click="rejectChange(index)"
            >
              Reject
            </v-btn>
            <v-btn
              color="green"
              :loading="decisionLoading[index]"
              variant="elevated"
              @click="acceptChange(index)"
            >
              Accept
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <input
      v-if="pdfBlobUrl"
      ref="fileInput"
      accept="application/pdf,.pdf"
      class="d-none"
      type="file"
      @change="onFileChange"
    />
  </v-container>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

interface LineHighlight {
  text: string;
  label: string;
}

interface ParsedLineContext {
  separator: string;
  header: string;
  sizes: string;
  override: string;
  amounts: string;
  headerHighlights: LineHighlight[];
  sizesHighlights: LineHighlight[];
  overrideHighlights: LineHighlight[];
  amountsHighlights: LineHighlight[];
}

interface ParserResults {
  material: Partial<Material>;
  costPerFoot: number;
  unitType: string;
  rate: number;
  weight: number;
  feet: number;
  lineContext: ParsedLineContext;
}

interface MaterialParsePreview {
  parsed: ParserResults;
  existingMaterial: Material | null;
  currentCostPerFoot: number | null;
  proposedCostPerFoot: number;
  hasCostChange: boolean;
}

interface ParsePdfResponse {
  previews: MaterialParsePreview[];
  highlightedPdf: string | null;
}

interface LineSeg {
  text: string;
  label: string | null;
}

type DecisionState = 'rejected' | 'applied';

const RESULT_COLORS = [
  '#1976D2',
  '#388E3C',
  '#F57C00',
  '#7B1FA2',
  '#00838F',
  '#C62828',
  '#37474F',
  '#6A1B9A',
];

const FIELD_COLORS: Record<string, string> = {
  materialType: '#FFF176',
  type: '#A5D6A7',
  dimension: '#90CAF9',
  rate: '#FFCC80',
};

const isDragging = ref(false);
const uploading = ref(false);
const error = ref('');
const fileName = ref('');
const pdfBlobUrl = ref<string | null>(null);
const previews = ref<MaterialParsePreview[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const decisions = ref<Record<number, DecisionState>>({});
const decisionLoading = ref<Record<number, boolean>>({});

onUnmounted(() => {
  if (pdfBlobUrl.value) URL.revokeObjectURL(pdfBlobUrl.value);
});

function openFilePicker() {
  fileInput.value?.click();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void uploadPdf(file);
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void uploadPdf(file);
}

function reset() {
  if (pdfBlobUrl.value) URL.revokeObjectURL(pdfBlobUrl.value);
  pdfBlobUrl.value = null;
  previews.value = [];
  decisions.value = {};
  decisionLoading.value = {};
  error.value = '';
  fileName.value = '';
}

async function uploadPdf(file: File) {
  if (!isPdf(file)) {
    error.value = 'Please upload a PDF file.';
    return;
  }

  reset();
  uploading.value = true;
  fileName.value = file.name;
  pdfBlobUrl.value = URL.createObjectURL(file);

  try {
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await api.post<ParsePdfResponse>('/materials/parse-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    previews.value = response.data.previews;

    if (response.data.highlightedPdf) {
      const highlightedBlob = base64PdfToBlob(response.data.highlightedPdf);
      if (pdfBlobUrl.value) URL.revokeObjectURL(pdfBlobUrl.value);
      pdfBlobUrl.value = URL.createObjectURL(highlightedBlob);
    }
  } catch (e) {
    console.error(e);
    error.value = 'Failed to parse PDF.';
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function base64PdfToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

function materialTitle(result: MaterialParsePreview): string {
  const m = result.parsed.material;
  const mType = m.materialType ?? 'Unknown';
  const type = m.type ?? 'Unknown';
  return type === 'Flat'
    ? `${mType} Flat  ${m.height ?? '?'} × ${m.width ?? '?'} × ${m.length ?? '?'}`
    : `${mType} Round  ⌀${m.diameter ?? '?'} × ${m.length ?? '?'}`;
}

function formatMoney(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `$${value.toFixed(2)}`;
}

function formatNum(value: number): string {
  return Number.isFinite(value) ? parseFloat(value.toFixed(4)).toString() : '—';
}

function resultColor(index: number): string {
  return RESULT_COLORS[index % RESULT_COLORS.length] ?? '#1976D2';
}

function fieldColor(label: string): string {
  return FIELD_COLORS[label] ?? '#E0E0E0';
}

interface LineEntry {
  label: string;
  line: string;
  highlights: LineHighlight[];
}

function lineEntries(result: MaterialParsePreview): LineEntry[] {
  const ctx = result.parsed.lineContext;
  return [
    { label: 'description', line: ctx.header, highlights: ctx.headerHighlights },
    { label: 'dimensions', line: ctx.sizes, highlights: ctx.sizesHighlights },
    ...(ctx.override
      ? [{ label: 'override', line: ctx.override, highlights: ctx.overrideHighlights }]
      : []),
    { label: 'pricing', line: ctx.amounts, highlights: ctx.amountsHighlights },
  ];
}

function segmentLine(line: string, highlights: LineHighlight[]): LineSeg[] {
  if (!highlights.length) return [{ text: line, label: null }];

  const sorted = [...highlights]
    .map((h) => ({ ...h, idx: line.indexOf(h.text) }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const segs: LineSeg[] = [];
  let pos = 0;
  for (const h of sorted) {
    if (h.idx > pos) segs.push({ text: line.slice(pos, h.idx), label: null });
    segs.push({ text: h.text, label: h.label });
    pos = h.idx + h.text.length;
  }
  if (pos < line.length) segs.push({ text: line.slice(pos), label: null });
  return segs;
}

function rejectChange(index: number) {
  decisions.value[index] = 'rejected';
}

async function acceptChange(index: number) {
  const result = previews.value[index];
  if (!result?.existingMaterial?._id) return;

  try {
    decisionLoading.value[index] = true;
    await api.post<Material[]>('/materials/parse-pdf/apply', {
      updates: [
        { materialId: result.existingMaterial._id, costPerFoot: result.proposedCostPerFoot },
      ],
    });
    decisions.value[index] = 'applied';
    result.currentCostPerFoot = result.proposedCostPerFoot;
    result.hasCostChange = false;
    toastSuccess('Material cost updated.');
  } catch (e) {
    console.error(e);
    toastError('Failed to update material cost.');
  } finally {
    decisionLoading.value[index] = false;
  }
}
</script>

<style scoped>
.drop-zone {
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.4);
  border-radius: 8px;
  cursor: pointer;
  padding: 48px 16px;
  text-align: center;
  transition: border-color 0.15s;
}

.drop-zone--active {
  border-color: rgb(var(--v-theme-primary));
}

.drop-zone--loading {
  opacity: 0.7;
  pointer-events: none;
}

.pdf-embed {
  display: block;
  width: 100%;
  height: 80vh;
  border: none;
}

.parsed-lines {
  font-family: monospace;
}

.parsed-line-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px;
}

.line-label {
  white-space: nowrap;
  min-width: 72px;
}

.line-value {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.75rem;
}

.cost-math {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  font-family: monospace;
}
</style>
