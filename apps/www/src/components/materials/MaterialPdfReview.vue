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

        <div v-if="previews.length > 0" class="d-flex align-center justify-space-between mb-2">
          <div class="text-caption text-medium-emphasis">
            {{ visibleEntries.length }}
            visible
            <template v-if="hiddenResolvedCount > 0"> · {{ hiddenResolvedCount }} hidden</template>
          </div>
          <v-btn
            density="compact"
            size="small"
            variant="text"
            @click="hideResolved = !hideResolved"
          >
            {{ hideResolved ? 'Show completed' : 'Hide completed' }}
          </v-btn>
        </div>

        <div
          v-if="!uploading && previews.length === 0"
          class="text-body-2 text-medium-emphasis pa-2"
        >
          No recognized materials found in this PDF.
        </div>

        <v-alert
          v-else-if="!uploading && visibleEntries.length === 0"
          class="mb-3"
          density="compact"
          type="success"
          variant="tonal"
        >
          All materials costs are up to date.
        </v-alert>

        <div
          v-if="!uploading && visibleEntries.length === 0"
          class="text-caption text-medium-emphasis mb-3"
        >
          Use “Show completed” above to toggle finished cards.
        </div>

        <v-card v-for="entry in visibleEntries" :key="entry.index" class="mb-4" variant="outlined">
          <div :style="{ height: '4px', background: resultColor(entry.result, entry.index) }" />

          <v-card-title class="text-subtitle-1 pt-3">
            {{ materialTitle(entry.result) }}
          </v-card-title>

          <v-card-text>
            <div class="parsed-lines mb-3">
              <div
                v-for="(lineEntry, li) in lineEntries(entry.result)"
                :key="li"
                class="parsed-line-row mb-1"
              >
                <span class="line-label text-caption text-medium-emphasis mr-1"
                  >{{ lineEntry.label }}:</span
                >
                <code class="text-caption line-value">
                  <template
                    v-for="(seg, si) in segmentLine(lineEntry.line, lineEntry.highlights)"
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

            <div v-if="entry.result.parsed.unitType === 'lb'" class="cost-math text-caption mb-3">
              <span class="text-medium-emphasis"
                >{{ formatNum(entry.result.parsed.weight) }}
                lbs</span
              >
              <span class="mx-1">×</span>
              <span class="text-medium-emphasis"
                >{{ formatMoney(entry.result.parsed.rate) }}/lb</span
              >
              <span class="mx-1">=</span>
              <span class="text-medium-emphasis"
                >{{ formatMoney(entry.result.parsed.weight * entry.result.parsed.rate) }}
                total</span
              >
              <span class="mx-1">÷</span>
              <span class="text-medium-emphasis">{{ formatNum(entry.result.parsed.feet) }} ft</span>
              <span class="mx-1">=</span>
              <strong>{{ formatMoney(entry.result.proposedCostPerFoot) }}/ft</strong>
            </div>
            <div
              v-else-if="entry.result.parsed.unitType === 'ea'"
              class="cost-math text-caption mb-3"
            >
              <span class="text-medium-emphasis"
                >{{ formatMoney(entry.result.parsed.rate) }}/bar</span
              >
              <span class="mx-1">÷</span>
              <span class="text-medium-emphasis">{{ formatNum(entry.result.parsed.feet) }} ft</span>
              <span class="mx-1">=</span>
              <strong>{{ formatMoney(entry.result.proposedCostPerFoot) }}/ft</strong>
            </div>

            <div class="d-flex align-center" style="gap: 16px;">
              <div>
                <div class="text-caption text-medium-emphasis">
                  {{ fromCostLabel(entry.index) }}
                </div>
                <div class="text-body-2">
                  {{ formatMoney(displayCurrentCost(entry.result, entry.index)) }}
                </div>
              </div>
              <v-icon size="small">mdi-arrow-right</v-icon>
              <div>
                <div class="text-caption text-medium-emphasis">{{ toCostLabel(entry.index) }}</div>
                <div class="text-body-2 font-weight-bold">
                  {{ formatMoney(entry.result.proposedCostPerFoot) }}
                </div>
              </div>
            </div>

            <v-alert
              v-if="decisions[entry.index] === 'added'"
              class="mt-3"
              density="compact"
              type="success"
              variant="tonal"
            >
              Material added.
            </v-alert>
            <v-alert
              v-else-if="!entry.result.existingMaterial"
              class="mt-3"
              density="compact"
              type="warning"
              variant="tonal"
            >
              No matching material in database.
            </v-alert>
            <v-alert
              v-else-if="decisions[entry.index] === 'applied'"
              class="mt-3"
              density="compact"
              type="success"
              variant="tonal"
            >
              Cost updated.
            </v-alert>
            <v-alert
              v-else-if="decisions[entry.index] === 'rejected'"
              class="mt-3"
              density="compact"
              type="info"
              variant="tonal"
            >
              Change rejected.
            </v-alert>
            <v-alert
              v-else-if="!entry.result.hasCostChange"
              class="mt-3"
              density="compact"
              type="info"
              variant="tonal"
            >
              Cost is already up to date.
            </v-alert>
          </v-card-text>

          <v-card-actions
            v-if="entry.result.existingMaterial && entry.result.hasCostChange && !decisions[entry.index]"
          >
            <v-spacer />
            <v-btn
              color="red"
              :disabled="decisionLoading[entry.index]"
              variant="outlined"
              @click="rejectChange(entry.index)"
            >
              Reject
            </v-btn>
            <v-btn
              color="green"
              :loading="decisionLoading[entry.index]"
              variant="elevated"
              @click="acceptChange(entry.index)"
            >
              Accept
            </v-btn>
          </v-card-actions>

          <v-card-actions v-else-if="!entry.result.existingMaterial && !decisions[entry.index]">
            <v-spacer />
            <v-btn
              color="green"
              :loading="decisionLoading[entry.index]"
              variant="elevated"
              @click="addMaterial(entry.index)"
            >
              Add material
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
import { computed, onUnmounted, ref, watch } from 'vue';
import api from '@/plugins/axios';
import { buildMaterialDescription, formatCrossSectionDimension } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { useMaterialsStore } from '@/stores/materials_store';

const materialsStore = useMaterialsStore();

const emit = defineEmits<(event: 'has-preview-change', hasPreview: boolean) => void>();

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
  date: string;
  dateHighlights: LineHighlight[];
}

interface ParserResults {
  material: Partial<MaterialCreate>;
  costPerFoot: number;
  unitType: string;
  rate: number;
  weight: number;
  feet: number;
  lineContext: ParsedLineContext;
  createdAt: string;
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

type DecisionState = 'rejected' | 'applied' | 'added';

const RESULT_COLORS = {
  waiting: '#7B1FA2',
  noChange: '#81D4FA',
  applied: '#2E7D32',
  rejected: '#C62828',
  missingMaterial: '#F57C00',
} as const;

const FIELD_COLORS: Record<string, string> = {
  materialType: '#FFF176',
  type: '#A5D6A7',
  dimension: '#90CAF9',
  rate: '#FFCC80',
  date: '#CE93D8',
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
const acceptedFromCostPerFoot = ref<Record<number, number | null>>({});
const hideResolved = ref(true);

watch(
  pdfBlobUrl,
  (value) => {
    emit('has-preview-change', Boolean(value));
  },
  { immediate: true },
);

const visibleEntries = computed(() => {
  return previews.value
    .map((result, index) => ({ result, index }))
    .filter((entry) => !hideResolved.value || !isResolved(entry.result, entry.index));
});

const hiddenResolvedCount = computed(() => previews.value.length - visibleEntries.value.length);

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
  acceptedFromCostPerFoot.value = {};
  hideResolved.value = true;
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

  const dimensionUnit = m.isMetric ? 'mm' : '';
  const height = formatCrossSectionDimension(m.height, m.isMetric);
  const width = formatCrossSectionDimension(m.width, m.isMetric);
  const diameter = formatCrossSectionDimension(m.diameter, m.isMetric);
  const wall = formatCrossSectionDimension(m.wallThickness, m.isMetric);

  return type === 'Flat'
    ? `${mType} Flat  ${height || '?'}${dimensionUnit} × ${width || '?'}${dimensionUnit} × ${m.length ?? '?'}`
    : `${mType} Round  ⌀${diameter || '?'}${dimensionUnit}${wall ? ` × ${wall}${dimensionUnit}` : ''} × ${m.length ?? '?'}`;
}

function formatMoney(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `$${value.toFixed(2)}`;
}

function formatNum(value: number): string {
  return Number.isFinite(value) ? parseFloat(value.toFixed(4)).toString() : '—';
}

function displayCurrentCost(result: MaterialParsePreview, index: number): number | null {
  if (decisions.value[index] === 'applied' && index in acceptedFromCostPerFoot.value) {
    return acceptedFromCostPerFoot.value[index] ?? null;
  }
  return result.currentCostPerFoot;
}

function fromCostLabel(index: number): string {
  return decisions.value[index] === 'applied' ? 'Original ($/ft)' : 'Current ($/ft)';
}

function toCostLabel(index: number): string {
  return decisions.value[index] === 'applied' ? 'Changed to ($/ft)' : 'Proposed ($/ft)';
}

function resultColor(result: MaterialParsePreview, index: number): string {
  if (decisions.value[index] === 'added') return RESULT_COLORS.applied;
  if (!result.existingMaterial) return RESULT_COLORS.missingMaterial;
  if (decisions.value[index] === 'applied') return RESULT_COLORS.applied;
  if (decisions.value[index] === 'rejected') return RESULT_COLORS.rejected;
  if (!result.hasCostChange) return RESULT_COLORS.noChange;
  return RESULT_COLORS.waiting;
}

function isResolved(result: MaterialParsePreview, index: number): boolean {
  const decision = decisions.value[index];
  if (decision === 'added' || decision === 'applied' || decision === 'rejected') return true;
  if (result.existingMaterial && !result.hasCostChange) return true;
  return false;
}

function buildMaterialFromParsedResult(result: MaterialParsePreview): MaterialCreate | null {
  const parsedMaterial = result.parsed.material;
  if (!parsedMaterial.materialType || !parsedMaterial.type || !parsedMaterial.supplier) return null;

  const material: MaterialCreate = {
    description: '',
    materialType: parsedMaterial.materialType,
    type: parsedMaterial.type,
    isMetric: parsedMaterial.isMetric ?? false,
    height: parsedMaterial.height ?? null,
    width: parsedMaterial.width ?? null,
    diameter: parsedMaterial.diameter ?? null,
    wallThickness: parsedMaterial.wallThickness ?? null,
    length: parsedMaterial.length ?? null,
    supplier: parsedMaterial.supplier,
    costPerFoot: result.proposedCostPerFoot,
  };

  material.description = buildMaterialDescription(material);
  return material;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fieldColor(label: string): string {
  const hex = FIELD_COLORS[label] ?? '#E0E0E0';
  return hexToRgba(hex, 0.35);
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
    ...(ctx.date ? [{ label: 'date', line: ctx.date, highlights: ctx.dateHighlights }] : []),
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
  toastError('Material cost change rejected.');
}

async function acceptChange(index: number) {
  const result = previews.value[index];
  if (!result?.existingMaterial?._id) return;

  try {
    decisionLoading.value[index] = true;
    const previousCostPerFoot = result.currentCostPerFoot;
    await api.post<Material[]>('/materials/parse-pdf/apply', {
      updates: [
        {
          materialId: result.existingMaterial._id,
          costPerFoot: result.proposedCostPerFoot,
        },
      ],
    });
    acceptedFromCostPerFoot.value[index] = previousCostPerFoot;
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

async function addMaterial(index: number) {
  const result = previews.value[index];
  if (!result) return;
  if (result.existingMaterial) {
    toastError('Material already exists in database.');
    return;
  }

  const material = buildMaterialFromParsedResult(result);
  if (!material) {
    toastError('Missing parsed material fields. Cannot add material.');
    return;
  }

  try {
    decisionLoading.value[index] = true;
    const data = await materialsStore.add(material);
    result.existingMaterial = data;
    result.currentCostPerFoot = data.costPerFoot;
    result.proposedCostPerFoot = data.costPerFoot ?? result.proposedCostPerFoot;
    result.hasCostChange = false;
    decisions.value[index] = 'added';
    toastSuccess('Material added successfully.');
  } catch (e) {
    console.error(e);
    toastError('Failed to add material.');
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
