<template>
  <v-card class="label-layout-settings" rounded="lg">
    <div class="label-layout-settings__hero">
      <div>
        <h3 class="label-layout-settings__title">Item Label Offset</h3>
        <p class="label-layout-settings__copy">
          Shift the rendered item label on the DYMO address label.
        </p>
      </div>

      <div class="label-layout-settings__actions">
        <v-btn
          :disabled="!isDirty || miscSettingsStore.saving"
          prepend-icon="mdi-restore"
          variant="text"
          @click="resetDraft"
        >
          Reset
        </v-btn>
        <v-btn
          color="primary"
          :disabled="!isDirty"
          :loading="miscSettingsStore.saving"
          prepend-icon="mdi-content-save-outline"
          @click="save"
        >
          Save Changes
        </v-btn>
      </div>
    </div>

    <v-progress-linear
      v-if="miscSettingsStore.loading && !miscSettingsStore.loaded"
      indeterminate
    />

    <div class="label-layout-settings__grid">
      <div class="label-layout-settings__controls">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="draftOffset.x"
              density="comfortable"
              hide-details="auto"
              label="X Offset"
              step="0.01"
              suffix="in"
              type="number"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="draftOffset.y"
              density="comfortable"
              hide-details="auto"
              label="Y Offset"
              step="0.01"
              suffix="in"
              type="number"
              variant="outlined"
            />
          </v-col>
        </v-row>

        <div class="label-layout-settings__readout">
          Saved offset: X {{ formatOffset(miscSettingsStore.settings.itemLabelOffset.x) }}, Y
          {{ formatOffset(miscSettingsStore.settings.itemLabelOffset.y) }}
        </div>
      </div>

      <div class="label-layout-settings__preview-wrap">
        <div class="label-layout-settings__preview-header">
          <span>DYMO 30252 Preview</span>
          <span>{{ formatOffset(draftOffset.x) }}, {{ formatOffset(draftOffset.y) }}</span>
        </div>

        <div class="label-layout-settings__preview-stage">
          <div class="label-layout-settings__stock" :style="stockStyle">
            <div class="label-layout-settings__frame" :style="frameStyle">
              <div class="label-layout-settings__frame-image">
                <div class="label-layout-settings__frame-image-mark">IMG</div>
              </div>

              <div class="label-layout-settings__frame-copy">
                <div class="label-layout-settings__frame-description">ALUMINUM SPACER BLOCK</div>
                <div class="label-layout-settings__frame-entity">BK MACHINE</div>
                <div class="label-layout-settings__frame-part">PART-2046</div>
              </div>

              <div class="label-layout-settings__frame-code">
                <div class="label-layout-settings__qr">
                  <span
                    class="label-layout-settings__qr-finder label-layout-settings__qr-finder--tl"
                  />
                  <span
                    class="label-layout-settings__qr-finder label-layout-settings__qr-finder--tr"
                  />
                  <span
                    class="label-layout-settings__qr-finder label-layout-settings__qr-finder--bl"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--a"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--b"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--c"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--d"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--e"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--f"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--g"
                  />
                  <span
                    class="label-layout-settings__qr-module label-layout-settings__qr-module--h"
                  />
                  <span class="label-layout-settings__qr-center" />
                </div>
                <div class="label-layout-settings__frame-location">A12</div>
                <div class="label-layout-settings__frame-location">B4</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { useMiscSettingsStore } from '@/stores/misc_settings_store';

const miscSettingsStore = useMiscSettingsStore();
const draftOffset = ref<LabelOffset>({ x: 0, y: 0 });

const PREVIEW_SCALE = 120;
const LABEL_WIDTH_IN = 3.5;
const LABEL_HEIGHT_IN = 1.125;
const FRAME_LEFT_IN = 0.12;
const FRAME_TOP_IN = 0.08;
const FRAME_WIDTH_IN = 2.96;
const FRAME_HEIGHT_IN = 0.88;
const PREVIEW_BASE_OFFSET_X = 0.05;
const PREVIEW_BASE_OFFSET_Y = -0.01;

const stockStyle = computed(() => ({
  width: `${LABEL_WIDTH_IN * PREVIEW_SCALE}px`,
  height: `${LABEL_HEIGHT_IN * PREVIEW_SCALE}px`,
}));

const frameStyle = computed(() => ({
  left: `${FRAME_LEFT_IN * PREVIEW_SCALE}px`,
  top: `${FRAME_TOP_IN * PREVIEW_SCALE}px`,
  width: `${FRAME_WIDTH_IN * PREVIEW_SCALE}px`,
  height: `${FRAME_HEIGHT_IN * PREVIEW_SCALE}px`,
  transform: `translate(${(PREVIEW_BASE_OFFSET_X + draftOffset.value.x) * PREVIEW_SCALE}px, ${(PREVIEW_BASE_OFFSET_Y + draftOffset.value.y) * PREVIEW_SCALE}px)`,
}));

const isDirty = computed(() => {
  return (
    draftOffset.value.x !== miscSettingsStore.settings.itemLabelOffset.x ||
    draftOffset.value.y !== miscSettingsStore.settings.itemLabelOffset.y
  );
});

onMounted(() => {
  syncDraft();
  void fetchSettings();
});

async function fetchSettings() {
  try {
    await miscSettingsStore.fetch();
    syncDraft();
  } catch {
    toastError('Unable to load item label settings.');
  }
}

function syncDraft() {
  draftOffset.value = {
    x: miscSettingsStore.settings.itemLabelOffset.x,
    y: miscSettingsStore.settings.itemLabelOffset.y,
  };
}

function resetDraft() {
  syncDraft();
}

function sanitizeOffsetValue(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function formatOffset(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}in`;
}

async function save() {
  try {
    const normalizedOffset = {
      x: sanitizeOffsetValue(draftOffset.value.x),
      y: sanitizeOffsetValue(draftOffset.value.y),
    };
    await miscSettingsStore.save(normalizedOffset);
    syncDraft();
    toastSuccess('Item label settings updated successfully.');
  } catch {
    toastError('Unable to save item label settings.');
  }
}
</script>

<style scoped>
.label-layout-settings {
  padding: 20px;
}

.label-layout-settings__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.label-layout-settings__title {
  margin: 0;
  font-size: 1.1rem;
}

.label-layout-settings__copy {
  margin: 6px 0 0;
  max-width: 52ch;
}

.label-layout-settings__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.label-layout-settings__grid {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  margin-top: 20px;
}

.label-layout-settings__controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.label-layout-settings__notes {
  display: grid;
  gap: 6px;
  font-size: 0.95rem;
}

.label-layout-settings__notes p,
.label-layout-settings__readout {
  margin: 0;
}

.label-layout-settings__readout {
  padding: 12px 14px;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
  font-weight: 600;
}

.label-layout-settings__preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label-layout-settings__preview-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.95rem;
  font-weight: 600;
}

.label-layout-settings__preview-stage {
  padding: 22px;
  border-radius: 20px;
  background:
    radial-gradient(circle at top left, rgba(52, 152, 219, 0.15), transparent 32%),
    linear-gradient(135deg, #f6f8fb, #e9eef5);
  border: 1px solid #d8e0ea;
  overflow-x: auto;
}

.label-layout-settings__stock {
  position: relative;
  border-radius: 18px;
  background:
    linear-gradient(180deg, #ffffff, #f3f4f6),
    repeating-linear-gradient(
      90deg,
      rgba(15, 23, 42, 0.03),
      rgba(15, 23, 42, 0.03) 2px,
      transparent 2px,
      transparent 14px
    );
  border: 1px solid #ccd5df;
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.label-layout-settings__stock::before,
.label-layout-settings__stock::after {
  content: "";
  position: absolute;
  top: 14px;
  bottom: 14px;
  width: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
}

.label-layout-settings__stock::before {
  left: 10px;
}

.label-layout-settings__stock::after {
  right: 10px;
}

.label-layout-settings__stock-badge {
  position: absolute;
  top: 10px;
  right: 14px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.label-layout-settings__frame {
  position: absolute;
  display: grid;
  grid-template-columns: 0.52in 1fr 0.68in;
  gap: 10px;
  padding: 8px 10px 7px;
  border: 3px solid #1d4ed8;
  background: rgba(191, 219, 254, 0.12);
  box-shadow: 0 0 0 1px rgba(29, 78, 216, 0.15);
}

.label-layout-settings__frame-image {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.02)),
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 8px,
      rgba(15, 23, 42, 0.05) 8px,
      rgba(15, 23, 42, 0.05) 16px
    );
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.label-layout-settings__frame-image-mark {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.label-layout-settings__frame-copy {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10px;
  min-width: 0;
  padding-top: 1px;
}

.label-layout-settings__frame-description,
.label-layout-settings__frame-entity,
.label-layout-settings__frame-part,
.label-layout-settings__frame-location {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.label-layout-settings__frame-description {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0.01em;
}

.label-layout-settings__frame-entity {
  font-size: 10px;
  color: rgba(15, 23, 42, 0.72);
}

.label-layout-settings__frame-part {
  margin-top: auto;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.label-layout-settings__frame-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 3px;
  padding-top: 1px;
}

.label-layout-settings__qr {
  position: relative;
  width: 50px;
  height: 50px;
  overflow: hidden;
  background:
    repeating-conic-gradient(from 45deg, #111827 0 25%, white 0 50%) center / 10px 10px,
    white;
  border: 3px solid white;
  box-shadow:
    inset 0 0 0 1px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(15, 23, 42, 0.08);
}

.label-layout-settings__qr::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      transparent 0 22%,
      white 22% 28%,
      transparent 28% 58%,
      white 58% 64%,
      transparent 64% 100%
    ),
    linear-gradient(
      transparent 0 18%,
      white 18% 24%,
      transparent 24% 54%,
      white 54% 60%,
      transparent 60% 100%
    );
  opacity: 0.45;
}

.label-layout-settings__qr-finder {
  position: absolute;
  z-index: 2;
  width: 13px;
  height: 13px;
  border: 3px solid #0f172a;
  background: white;
}

.label-layout-settings__qr-finder::after {
  content: "";
  position: absolute;
  inset: 3px;
  background: #0f172a;
}

.label-layout-settings__qr-finder--tl {
  top: 4px;
  left: 4px;
}

.label-layout-settings__qr-finder--tr {
  top: 4px;
  right: 4px;
}

.label-layout-settings__qr-finder--bl {
  bottom: 4px;
  left: 4px;
}

.label-layout-settings__qr-module,
.label-layout-settings__qr-center {
  position: absolute;
  z-index: 1;
  background: #111827;
}

.label-layout-settings__qr-module {
  width: 5px;
  height: 5px;
}

.label-layout-settings__qr-module--a {
  top: 8px;
  left: 23px;
}

.label-layout-settings__qr-module--b {
  top: 15px;
  left: 30px;
}

.label-layout-settings__qr-module--c {
  top: 19px;
  left: 20px;
}

.label-layout-settings__qr-module--d {
  top: 27px;
  left: 28px;
}

.label-layout-settings__qr-module--e {
  top: 31px;
  left: 20px;
}

.label-layout-settings__qr-module--f {
  top: 36px;
  left: 30px;
}

.label-layout-settings__qr-module--g {
  top: 24px;
  left: 37px;
}

.label-layout-settings__qr-module--h {
  top: 36px;
  left: 14px;
}

.label-layout-settings__qr-center {
  top: 22px;
  left: 22px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: white;
  box-shadow: 0 0 0 2px #111827;
}

.label-layout-settings__frame-location {
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

@media (max-width: 960px) {
  .label-layout-settings__hero,
  .label-layout-settings__preview-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .label-layout-settings__grid {
    grid-template-columns: 1fr;
  }
}
</style>
