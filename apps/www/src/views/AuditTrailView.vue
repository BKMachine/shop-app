<template>
  <v-container>
    <div class="audit-panel">
      <div class="audit-toolbar">
        <div>
          <div class="audit-title">Live Audit Trail</div>
          <div class="audit-subtitle">
            Recent database changes across inventory and administrative records.
          </div>
        </div>
      </div>

      <div v-if="loading && audits.length === 0" class="audit-state">Loading audit trail...</div>
      <div v-else-if="!loading && audits.length === 0" class="audit-state">
        No recent audited changes.
      </div>

      <div v-else class="audit-layout">
        <v-infinite-scroll
          class="audit-scroll"
          :height="700"
          :items="audits"
          mode="intersect"
          @load="loadMore"
        >
          <div class="audit-list">
            <template v-for="audit in audits" :key="audit._id">
              <v-card
                class="audit-card"
                :class="[
                  getEntityThemeClass(audit.type),
                  `audit-card-${getAction(audit)}`,
                  { 'audit-card-selected': selectedAudit?._id === audit._id },
                ]"
                variant="outlined"
                @click="selectAudit(audit._id)"
              >
                <v-card-text class="audit-card__content">
                  <div class="audit-card__header">
                    <div class="audit-card__identity">
                      <div class="audit-icon" :class="getEntityThemeClass(audit.type)">
                        <v-icon :icon="getEntityIcon(audit.type)" size="18" />
                      </div>
                      <v-img
                        v-if="getAuditImageUrl(audit)"
                        class="audit-preview"
                        contain
                        :src="getAuditImageUrl(audit)"
                      />
                      <div class="audit-title-block">
                        <div class="audit-headline-row">
                          <div class="audit-headline">{{ getHeadline(audit) }}</div>
                          <v-btn
                            v-if="getAuditRoute(audit)"
                            class="audit-link-btn"
                            icon
                            size="x-small"
                            title="Open item"
                            :to="getAuditRoute(audit)"
                            variant="text"
                            @click.stop
                          >
                            <v-icon icon="mdi-open-in-new" size="16" />
                          </v-btn>
                        </div>
                      </div>
                    </div>

                    <div class="audit-card__meta">
                      <div class="audit-meta-line">
                        <span
                          v-if="getDeviceIcon(audit.device)"
                          :class="['device-indicator', `device-indicator-${getDeviceType(audit.device)}`]"
                        >
                          <v-icon :icon="getDeviceIcon(audit.device)" size="14" />
                          <v-tooltip activator="parent" location="top" open-delay="250">
                            {{ getDeviceName(audit.device) }}
                          </v-tooltip>
                        </span>
                        <span>{{ getDeviceName(audit.device) }}</span>
                      </div>
                      <div class="audit-meta-line">
                        <span :title="formatFullTimestamp(audit.timestamp)">
                          {{ formatTimestamp(audit.timestamp) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="audit-summary">
                    <v-chip
                      v-if="audit.mergedCount && audit.mergedCount > 1"
                      class="audit-change audit-change-merged"
                      density="comfortable"
                      size="small"
                      variant="tonal"
                    >
                      {{ audit.mergedCount }}
                      audits merged
                    </v-chip>
                    <v-chip
                      v-for="change in summarizeAudit(audit)"
                      :key="change.key"
                      class="audit-change"
                      density="comfortable"
                      size="small"
                      variant="tonal"
                    >
                      {{ change.label }}
                    </v-chip>
                  </div>

                  <div v-if="summarizeAudit(audit).length === 0" class="audit-empty-summary">
                    Structural change recorded.
                  </div>
                </v-card-text>
              </v-card>
            </template>
          </div>

          <template #empty> <div class="audit-scroll-state">All caught up.</div> </template>

          <template #loading>
            <div class="audit-scroll-state">Loading more audits...</div>
          </template>
        </v-infinite-scroll>

        <v-card v-if="selectedAudit" class="audit-detail-panel" variant="outlined">
          <v-card-text class="audit-detail-panel__content">
            <div class="audit-detail-panel__header">
              <div>
                <div class="audit-detail-panel__headline">{{ getHeadline(selectedAudit) }}</div>
                <div class="audit-detail-panel__meta">
                  <span>{{ getDeviceName(selectedAudit.device) }}</span>
                  <span>{{ formatFullTimestamp(selectedAudit.timestamp) }}</span>
                </div>
              </div>
              <v-btn
                v-if="getAuditRoute(selectedAudit)"
                class="audit-link-btn"
                icon
                size="small"
                title="Open item"
                :to="getAuditRoute(selectedAudit)"
                variant="text"
              >
                <v-icon icon="mdi-open-in-new" size="18" />
              </v-btn>
            </div>

            <div class="audit-detail-summary">
              <v-chip
                v-if="selectedAudit.mergedCount && selectedAudit.mergedCount > 1"
                class="audit-change audit-change-merged"
                density="compact"
                size="small"
                variant="tonal"
              >
                {{ selectedAudit.mergedCount }}
                audits merged
              </v-chip>
              <v-chip
                v-for="change in summarizeAudit(selectedAudit)"
                :key="change.key"
                class="audit-change"
                density="comfortable"
                size="small"
                variant="tonal"
              >
                {{ change.label }}
              </v-chip>
            </div>

            <div class="audit-json-grid">
              <div>
                <div class="audit-detail-title">Before</div>
                <div class="audit-json">
                  <div
                    v-for="(line, index) in getJsonLines(selectedAudit, 'before')"
                    :key="`before-${selectedAudit._id}-${index}`"
                    class="audit-json-line"
                    :class="getJsonLineClass(line)"
                  >
                    {{ line.text }}
                  </div>
                </div>
              </div>
              <div>
                <div class="audit-detail-title">After</div>
                <div class="audit-json">
                  <div
                    v-for="(line, index) in getJsonLines(selectedAudit, 'after')"
                    :key="`after-${selectedAudit._id}-${index}`"
                    class="audit-json-line"
                    :class="getJsonLineClass(line)"
                  >
                    {{ line.text }}
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { uiIcons } from '@/lib/uiIcons';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import useNowStore from '@/stores/now';

type AuditChange = {
  key: string;
  label: string;
};

type AuditDiffRow = {
  key: string;
  before: string;
  after: string;
  state: 'unchanged' | 'changed' | 'added' | 'removed';
};

type AuditJsonLine = {
  text: string;
  state: AuditDiffRow['state'] | 'plain';
};

type AuditFeedResponse = {
  items: Audit[];
  hasMore: boolean;
};

type InfiniteScrollDoneStatus = 'ok' | 'empty' | 'loading' | 'error';

const PAGE_SIZE = 20;
const audits = ref<Audit[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const selectedAuditId = ref<string | null>(null);
const nowStore = useNowStore();
const selectedAudit = computed(() =>
  audits.value.find((audit) => audit._id === selectedAuditId.value),
);

onMounted(() => {
  refreshAudits();
  socket.on('audit', refreshAudits);
});

onBeforeUnmount(() => {
  socket.off('audit', refreshAudits);
});

async function refreshAudits() {
  loading.value = true;
  try {
    const response = await api.post<AuditFeedResponse>('/audits', {
      limit: PAGE_SIZE,
      offset: 0,
    });
    audits.value = response.data.items;
    hasMore.value = response.data.hasMore;
    syncSelectedAudit();
  } finally {
    loading.value = false;
  }
}

async function loadMore({ done }: { done: (status: InfiniteScrollDoneStatus) => void }) {
  if (loading.value || loadingMore.value) {
    done('loading');
    return;
  }

  if (!hasMore.value) {
    done('empty');
    return;
  }

  loadingMore.value = true;
  try {
    const response = await api.post<AuditFeedResponse>('/audits', {
      limit: PAGE_SIZE,
      offset: audits.value.length,
    });

    if (response.data.items.length > 0) {
      audits.value = [...audits.value, ...response.data.items];
    }

    hasMore.value = response.data.hasMore;
    syncSelectedAudit();
    done(response.data.hasMore ? 'ok' : 'empty');
  } catch {
    done('error');
  } finally {
    loadingMore.value = false;
  }
}

function selectAudit(auditId: string) {
  selectedAuditId.value = auditId;
}

function syncSelectedAudit() {
  if (audits.value.length === 0) {
    selectedAuditId.value = null;
    return;
  }

  const hasSelection = audits.value.some((audit) => audit._id === selectedAuditId.value);
  if (!hasSelection) {
    selectedAuditId.value = audits.value[0]?._id ?? null;
  }
}

function getAction(audit: Audit) {
  if (!audit.old && audit.new) return 'created';
  if (audit.old && !audit.new) return 'deleted';
  return 'updated';
}

function getEntityLabel(type: Audit['type']) {
  const labels: Record<Audit['type'], string> = {
    tool: 'Tool',
    material: 'Material',
    part: 'Part',
    image: 'Image',
    document: 'Document',
    customer: 'Customer',
    supplier: 'Supplier',
    shipper: 'Shipper',
    vendor: 'Vendor',
    report: 'Email Report',
    part_note: 'Part Note',
  };

  return labels[type] ?? type;
}

function getEntityIcon(type: Audit['type']) {
  return uiIcons[type] ?? 'mdi-database-edit-outline';
}

function getEntityThemeClass(type: Audit['type']) {
  return `audit-theme-${type}`;
}

function formatTimestamp(timestamp: string) {
  const dateTime = DateTime.fromISO(timestamp);
  if (!dateTime.isValid) return timestamp;

  return (
    dateTime.toRelative({
      base: DateTime.fromJSDate(nowStore.now),
    }) ?? formatFullTimestamp(timestamp)
  );
}

function formatFullTimestamp(timestamp: string) {
  const dateTime = DateTime.fromISO(timestamp);
  if (!dateTime.isValid) return timestamp;
  return dateTime.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
}

function getDeviceName(device: Audit['device'] | string | null | undefined) {
  if (!device || typeof device === 'string') return 'Unknown device';
  return device.displayName || 'Unknown device';
}

function getDeviceIcon(device: Audit['device'] | string | undefined) {
  if (!device || typeof device === 'string') return undefined;
  if (device.deviceType === 'pc') return 'mdi-monitor';
  if (device.deviceType === 'android') return 'mdi-android';
  return undefined;
}

function getDeviceType(device: Audit['device'] | string | null | undefined) {
  if (!device || typeof device === 'string') return 'unknown';
  return device.deviceType;
}

function summarizeAudit(audit: Audit) {
  return describeAudit(audit).slice(0, 5);
}

function describeAudit(audit: Audit): AuditChange[] {
  const action = getAction(audit);
  const oldValue = normalizeRecord(audit.old);
  const newValue = normalizeRecord(audit.new);

  if (action === 'created') {
    return dedupeAuditChanges(
      Object.keys(newValue)
        .filter((key) => !isMetaField(key) && !isEmptyValue(newValue[key]))
        .map((key) => ({
          key,
          label: describeFieldChange(key, undefined, newValue[key]),
        })),
    );
  }

  if (action === 'deleted') {
    return dedupeAuditChanges(
      Object.keys(oldValue)
        .filter((key) => !isMetaField(key) && !isEmptyValue(oldValue[key]))
        .map((key) => ({
          key,
          label: describeFieldChange(key, oldValue[key], undefined),
        })),
    );
  }

  const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));

  return dedupeAuditChanges(
    keys
      .filter((key) => !isMetaField(key))
      .filter((key) => !areValuesEqual(oldValue[key], newValue[key]))
      .map((key) => ({
        key,
        label: describeFieldChange(key, oldValue[key], newValue[key]),
      })),
  );
}

function getHeadline(audit: Audit) {
  const subject = getAuditSubject(audit);
  const action = getAction(audit);

  if (action === 'created') return `${subject} was added`;
  if (action === 'deleted') return `${subject} was removed`;

  return `${subject} was updated`;
}

function getAuditSubject(audit: Audit) {
  const candidate = audit.new ?? audit.old ?? {};
  const record = normalizeRecord(candidate);
  return (
    record.originalName ||
    record.filename ||
    record.description ||
    record.name ||
    record.email ||
    record.part ||
    record.text ||
    record._id ||
    getEntityLabel(audit.type)
  );
}

function getAuditImageUrl(audit: Audit) {
  const newValue = normalizeRecord(audit.new);
  const oldValue = normalizeRecord(audit.old);
  const relPathCandidate =
    getStringField(newValue, 'relPath') || getStringField(oldValue, 'relPath');
  const candidates = [
    audit.type === 'image' && relPathCandidate ? `/images/${relPathCandidate}` : '',
    getStringField(newValue, 'img'),
    getStringField(oldValue, 'img'),
    getStringField(newValue, 'logo'),
    getStringField(oldValue, 'logo'),
    getStringField(newValue, 'image'),
    getStringField(oldValue, 'image'),
    getStringField(newValue, 'photo'),
    getStringField(oldValue, 'photo'),
  ];

  return candidates.find((value) => value.length > 0) ?? '';
}

function getAuditRoute(audit: Audit): RouteLocationRaw | undefined {
  const record = normalizeRecord(audit.new ?? audit.old);
  const id = typeof record._id === 'string' ? record._id : undefined;
  const entityType = getStringField(record, 'entityType');
  const entityId = getStringField(record, 'entityId');

  if (!id) return undefined;
  if (audit.type === 'tool') return { name: 'viewTool', params: { id } };
  if (audit.type === 'part') return { name: 'viewPart', params: { id } };
  if ((audit.type === 'image' || audit.type === 'document') && entityType === 'part' && entityId) {
    return { name: 'viewPart', params: { id: entityId } };
  }

  return undefined;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function dedupeAuditChanges(changes: AuditChange[]) {
  const seen = new Set<string>();
  return changes.filter((change) => {
    if (seen.has(change.label)) return false;
    seen.add(change.label);
    return true;
  });
}

function isMetaField(key: string) {
  return ['_id', '__v', 'createdAt', 'updatedAt'].includes(key);
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === '';
}

function areValuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function describeFieldChange(key: string, oldValue: unknown, newValue: unknown) {
  if (key === 'img') {
    if (isEmptyValue(oldValue) && !isEmptyValue(newValue)) {
      return 'Added the Main image';
    }

    if (!isEmptyValue(oldValue) && isEmptyValue(newValue)) {
      return 'Removed the Main image';
    }

    return 'Updated the Main image';
  }

  if (key === 'onOrder' && typeof newValue === 'boolean') {
    return newValue ? 'Flagged for reorder' : 'Restocked';
  }

  if (isImageField(key)) {
    if (isEmptyValue(oldValue) && !isEmptyValue(newValue)) {
      return 'Added an image';
    }

    if (!isEmptyValue(oldValue) && isEmptyValue(newValue)) {
      return 'Removed an image';
    }

    return 'Updated an image';
  }

  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    const delta = newValue - oldValue;
    if (delta !== 0) {
      return `Changed ${humanizeKey(key).toLowerCase()} from ${oldValue} to ${newValue}`;
    }
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    return `Updated ${humanizeKey(key).toLowerCase()}`;
  }

  if (isEmptyValue(oldValue) && !isEmptyValue(newValue)) {
    const label = humanizeKey(key).toLowerCase();
    return `Added ${indefiniteArticle(label)} ${label}`;
  }

  if (!isEmptyValue(oldValue) && isEmptyValue(newValue)) {
    const label = humanizeKey(key).toLowerCase();
    return `Removed ${indefiniteArticle(label)} ${label}`;
  }

  return `Updated ${humanizeKey(key).toLowerCase()}`;
}

function isImageField(key: string) {
  return ['img', 'image', 'photo', 'logo', 'imageIds', 'images'].includes(key);
}

function indefiniteArticle(value: string) {
  return /^[aeiou]/i.test(value) ? 'an' : 'a';
}

function getDiffRows(audit: Audit): AuditDiffRow[] {
  const oldValue = normalizeRecord(audit.old);
  const newValue = normalizeRecord(audit.new);
  const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));
  const orderedKeys = keys.filter((key) => !isMetaField(key)).sort((a, b) => a.localeCompare(b));

  if (orderedKeys.length === 0) {
    return [{ key: 'value', before: 'None', after: 'None', state: 'unchanged' }];
  }

  return orderedKeys.map((key) => {
    const beforeValue = oldValue[key];
    const afterValue = newValue[key];
    let state: AuditDiffRow['state'] = 'unchanged';

    if (isEmptyValue(beforeValue) && !isEmptyValue(afterValue)) {
      state = 'added';
    } else if (!isEmptyValue(beforeValue) && isEmptyValue(afterValue)) {
      state = 'removed';
    } else if (!areValuesEqual(beforeValue, afterValue)) {
      state = 'changed';
    }

    return {
      key,
      before: formatDiffValue(beforeValue),
      after: formatDiffValue(afterValue),
      state,
    };
  });
}

function formatDiffValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'None';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function getJsonLines(audit: Audit, side: 'before' | 'after'): AuditJsonLine[] {
  const value = side === 'before' ? audit.old : audit.new;
  if (value === null || value === undefined) {
    return [{ text: 'None', state: 'plain' }];
  }

  const stateByKey = new Map(getDiffRows(audit).map((row) => [row.key, row.state]));
  const lines = JSON.stringify(value, null, 2)?.split('\n') ?? ['None'];
  let activeKey: string | null = null;

  return lines.map((text) => {
    const topLevelKeyMatch = text.match(/^ {2}"([^"]+)":/);
    if (topLevelKeyMatch) {
      activeKey = topLevelKeyMatch[1] ?? null;
    }

    const state = activeKey ? (stateByKey.get(activeKey) ?? 'plain') : 'plain';

    if (side === 'before' && state === 'added') {
      return { text, state: 'plain' };
    }

    if (side === 'after' && state === 'removed') {
      return { text, state: 'plain' };
    }

    return { text, state };
  });
}

function getJsonLineClass(line: AuditJsonLine) {
  return line.state === 'plain' ? '' : `audit-json-line-${line.state}`;
}
</script>

<style scoped>
.audit-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 4px 4px 8px;
}

.audit-title {
  font-size: 18px;
  font-weight: 700;
  color: #243447;
}

.audit-subtitle {
  color: #637488;
  font-size: 13px;
}

.audit-state {
  padding: 20px;
  border-radius: 14px;
  border: 1px dashed #d5dde7;
  color: #67788b;
  background: linear-gradient(180deg, #fbfcfe 0%, #f5f8fc 100%);
}

.audit-layout {
  display: grid;
  grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.05fr);
  gap: 14px;
  align-items: start;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 8px;
  box-sizing: border-box;
}

.audit-scroll {
  width: 100%;
  padding-right: 6px;
  box-sizing: border-box;
  scrollbar-gutter: stable;
}

.audit-card {
  position: relative;
  border-radius: 16px;
  border: 1px solid #0f1720;
  overflow: hidden;
  background: white;
  cursor: pointer;
  transition:
    transform 0.14s ease,
    box-shadow 0.14s ease,
    border-color 0.14s ease;
}

.audit-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(15, 23, 32, 0.08);
}

.audit-card-selected {
  border-color: var(--audit-theme-color, #45617c);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--audit-theme-color, #45617c) 20%, transparent);
}

.audit-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 84px;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--audit-theme-color, #7890ab) 34%, white) 0%,
    color-mix(in srgb, var(--audit-theme-color, #7890ab) 12%, transparent) 48%,
    transparent 100%
  );
  pointer-events: none;
}

.audit-card__content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
}

.audit-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.audit-card__identity {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  flex: 1 1 auto;
}

.audit-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.audit-preview {
  width: 38px;
  height: 38px;
  min-width: 38px;
  max-width: 38px;
  border-radius: 12px;
  flex: 0 0 38px;
  overflow: hidden;
  border: 1px solid rgba(112, 132, 153, 0.2);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 6px 14px rgba(15, 23, 32, 0.08);
}

.audit-title-block {
  min-width: 0;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
}

.audit-headline-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.audit-theme-tool {
  --audit-theme-color: #1e88e5;
  --audit-theme-soft: rgba(30, 136, 229, 0.12);
}

.audit-theme-part {
  --audit-theme-color: #26a69a;
  --audit-theme-soft: rgba(38, 166, 154, 0.12);
}

.audit-theme-image {
  --audit-theme-color: #00897b;
  --audit-theme-soft: rgba(0, 137, 123, 0.12);
}

.audit-theme-document {
  --audit-theme-color: #6d4c41;
  --audit-theme-soft: rgba(109, 76, 65, 0.12);
}

.audit-theme-material {
  --audit-theme-color: #7e57c2;
  --audit-theme-soft: rgba(126, 87, 194, 0.12);
}

.audit-theme-customer {
  --audit-theme-color: #fb8c00;
  --audit-theme-soft: rgba(251, 140, 0, 0.12);
}

.audit-theme-supplier {
  --audit-theme-color: #43a047;
  --audit-theme-soft: rgba(67, 160, 71, 0.12);
}

.audit-theme-shipper {
  --audit-theme-color: #00897b;
  --audit-theme-soft: rgba(0, 137, 123, 0.12);
}

.audit-theme-vendor {
  --audit-theme-color: #8e24aa;
  --audit-theme-soft: rgba(142, 36, 170, 0.12);
}

.audit-theme-report {
  --audit-theme-color: #546e7a;
  --audit-theme-soft: rgba(84, 110, 122, 0.12);
}

.audit-theme-part_note {
  --audit-theme-color: #ef6c00;
  --audit-theme-soft: rgba(239, 108, 0, 0.12);
}

.audit-card.audit-theme-tool,
.audit-card.audit-theme-part,
.audit-card.audit-theme-image,
.audit-card.audit-theme-document,
.audit-card.audit-theme-material,
.audit-card.audit-theme-customer,
.audit-card.audit-theme-supplier,
.audit-card.audit-theme-shipper,
.audit-card.audit-theme-vendor,
.audit-card.audit-theme-report,
.audit-card.audit-theme-part_note {
  background-image: linear-gradient(180deg, var(--audit-theme-soft) 0%, transparent 56px);
}

.audit-icon.audit-theme-tool,
.audit-icon.audit-theme-part,
.audit-icon.audit-theme-image,
.audit-icon.audit-theme-document,
.audit-icon.audit-theme-material,
.audit-icon.audit-theme-customer,
.audit-icon.audit-theme-supplier,
.audit-icon.audit-theme-shipper,
.audit-icon.audit-theme-vendor,
.audit-icon.audit-theme-report,
.audit-icon.audit-theme-part_note {
  background: var(--audit-theme-color);
  box-shadow: inset 0 -8px 16px rgba(15, 23, 32, 0.18);
}

.audit-headline {
  font-size: 13px;
  font-weight: 600;
  color: #243447;
  line-height: 1.25;
  min-width: 0;
}

.audit-link-btn {
  flex-shrink: 0;
}

.audit-card__meta {
  text-align: right;
  color: #6a7b8e;
  font-size: 11px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  min-width: max-content;
}

.audit-meta-line {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
}

.audit-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.audit-change {
  max-width: 100%;
}

.audit-change-merged {
  background: rgba(41, 128, 185, 0.14);
  color: #1f5f8d;
}

.audit-empty-summary {
  font-size: 12px;
  color: #6e7f92;
}

.audit-detail-panel {
  position: sticky;
  top: 0;
  border-radius: 18px;
  border: 1px solid #dce6f0;
  background: linear-gradient(180deg, #fbfdff 0%, #f4f8fc 100%);
}

.audit-detail-panel__content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}

.audit-detail-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.audit-detail-panel__headline {
  font-size: 16px;
  font-weight: 700;
  color: #243447;
  line-height: 1.3;
}

.audit-detail-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 4px;
  color: #66788b;
  font-size: 12px;
}

.audit-detail-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.audit-detail-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #607285;
  margin-bottom: 8px;
}

.audit-json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.audit-json {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f1720;
  color: #d9e5f2;
  font-size: 12px;
  line-height: 1.45;
  overflow: auto;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;
}

.audit-json-line {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0 6px;
  margin: 0 -6px;
  border-radius: 6px;
}

.audit-json-line-changed {
  background: rgba(33, 150, 243, 0.16);
}

.audit-json-line-added {
  background: rgba(76, 175, 80, 0.16);
}

.audit-json-line-removed {
  background: rgba(239, 83, 80, 0.16);
}

.device-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7890ab;
  width: 16px;
  height: 16px;
  cursor: help;
}

.audit-scroll-state {
  padding: 12px;
  text-align: center;
  color: #6e7f92;
  font-size: 13px;
}

@media (max-width: 900px) {
  .audit-layout {
    grid-template-columns: 1fr;
  }

  .audit-detail-panel {
    position: static;
  }

  .audit-card__header {
    flex-direction: column;
  }

  .audit-card__meta {
    text-align: left;
  }

  .audit-meta-line {
    justify-content: flex-start;
  }

  .audit-json-grid {
    grid-template-columns: 1fr;
  }
}
</style>
