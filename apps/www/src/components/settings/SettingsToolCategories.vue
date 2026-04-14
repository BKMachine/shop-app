<template>
  <v-card class="tool-category-settings" rounded="lg">
    <div class="tool-category-settings__hero">
      <div>
        <h3 class="tool-category-settings__title">Tool Type Categories</h3>
        <p class="tool-category-settings__copy">
          Edit the ordered tool type lists used by filters and tool forms for each department.
        </p>
      </div>

      <div class="tool-category-settings__actions">
        <v-btn
          :disabled="!isDirty || toolCategoryStore.saving"
          prepend-icon="mdi-restore"
          variant="text"
          @click="resetDraft"
        >
          Reset
        </v-btn>
        <v-btn
          color="primary"
          :disabled="!isDirty"
          :loading="toolCategoryStore.saving"
          prepend-icon="mdi-content-save-outline"
          @click="save"
        >
          Save Changes
        </v-btn>
      </div>
    </div>

    <v-progress-linear
      v-if="toolCategoryStore.loading && !toolCategoryStore.loaded"
      indeterminate
    />

    <v-expansion-panels v-model="activeGroup" class="mt-1" variant="accordion">
      <v-expansion-panel v-for="group in GROUPS" :key="group.key" :value="group.key">
        <v-expansion-panel-title>
          <div class="tool-category-settings__panel-title">
            <div>
              <div class="tool-category-settings__group-title">{{ group.label }}</div>
              <div class="tool-category-settings__group-copy">{{ group.copy }}</div>
            </div>
            <v-chip size="small" variant="tonal">{{ draftGroups[group.key].length }} types</v-chip>
          </div>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <v-card
            v-if="activeGroup === group.key"
            class="tool-category-settings__group"
            rounded="lg"
            variant="outlined"
          >
            <div class="tool-category-settings__adder">
              <v-text-field
                v-model="draftInputs[group.key]"
                clearable
                density="comfortable"
                hide-details
                :label="`Add ${group.label} type`"
                variant="outlined"
                @keydown.enter.prevent="addType(group.key)"
              />
              <v-btn color="primary" prepend-icon="mdi-plus" @click="addType(group.key)">
                Add
              </v-btn>
            </div>

            <draggable
              v-if="draftGroups[group.key].length"
              v-model="draftGroups[group.key]"
              class="tool-category-settings__list"
              drag-class="tool-category-settings__row--dragging"
              ghost-class="tool-category-settings__row--ghost"
              handle=".tool-category-settings__drag-handle"
              item-key="id"
              @change="markDirty"
            >
              <template #item="{ element, index }">
                <div class="tool-category-settings__row">
                  <div class="tool-category-settings__index">{{ index + 1 }}</div>
                  <v-btn
                    class="tool-category-settings__drag-handle"
                    icon="mdi-drag"
                    size="small"
                    variant="text"
                  />
                  <v-text-field
                    v-model="element.value"
                    density="comfortable"
                    hide-details
                    variant="outlined"
                    @blur="sanitizeGroup(group.key)"
                    @update:model-value="markDirty"
                  >
                    <template #append-inner>
                      <v-chip
                        class="tool-category-settings__count-chip"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ toolCountLabel(group.key, element.value) }}
                      </v-chip>
                    </template>
                  </v-text-field>
                  <div class="tool-category-settings__row-actions">
                    <v-btn
                      color="error"
                      icon="mdi-delete-outline"
                      size="small"
                      variant="text"
                      @click="removeType(group.key, index)"
                    />
                  </div>
                </div>
              </template>
            </draggable>

            <div v-else class="tool-category-settings__empty">
              No tool types configured for {{ group.label.toLowerCase() }} yet.
            </div>
          </v-card>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import draggable from 'vuedraggable';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { useToolCategoryStore } from '@/stores/tool_category_store';

type DraftToolTypeItem = {
  id: string;
  value: string;
};

type DraftToolCategoryGroups = Record<ToolCategory, DraftToolTypeItem[]>;

const GROUPS: { key: ToolCategory; label: string; copy: string }[] = [
  {
    key: 'milling',
    label: 'Milling',
    copy: 'Shown on the mill tooling table and the tool edit form.',
  },
  {
    key: 'turning',
    label: 'Turning',
    copy: 'Shown on the lathe tooling table and the tool edit form.',
  },
  {
    key: 'swiss',
    label: 'Swiss',
    copy: 'Shown on the swiss tooling table and the tool edit form.',
  },
  {
    key: 'other',
    label: 'Other',
    copy: 'Shown for miscellaneous tooling and shop items.',
  },
];

const toolCategoryStore = useToolCategoryStore();
const activeGroup = ref<ToolCategory>();
const draftGroups = ref<DraftToolCategoryGroups>(
  createDraftGroups(toolCategoryStore.settings.groups),
);
const draftInputs = ref<Record<ToolCategory, string>>({
  milling: '',
  turning: '',
  swiss: '',
  other: '',
});
const isDirty = ref(false);

onMounted(() => {
  syncDraft();
  void fetchSettings();
});

async function fetchSettings() {
  try {
    await toolCategoryStore.fetch();
    syncDraft();
  } catch {
    toastError('Unable to load tool category settings.');
  }
}

function createDraftItem(value: string): DraftToolTypeItem {
  return {
    id: crypto.randomUUID(),
    value,
  };
}

function createDraftGroups(groups: ToolCategoryGroups): DraftToolCategoryGroups {
  return {
    milling: groups.milling.map(createDraftItem),
    turning: groups.turning.map(createDraftItem),
    swiss: groups.swiss.map(createDraftItem),
    other: groups.other.map(createDraftItem),
  };
}

function normalizeToolType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function normalizeDraftGroup(values: DraftToolTypeItem[]): DraftToolTypeItem[] {
  const seen = new Set<string>();
  const normalized: DraftToolTypeItem[] = [];

  for (const item of values) {
    const nextValue = normalizeToolType(item.value);
    if (!nextValue) continue;

    const key = nextValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      id: item.id,
      value: nextValue,
    });
  }

  return normalized;
}

function toStoredGroup(values: DraftToolTypeItem[]): string[] {
  return normalizeDraftGroup(values).map((item) => item.value);
}

function markDirty() {
  isDirty.value = true;
}

function syncDraft() {
  draftGroups.value = createDraftGroups(toolCategoryStore.settings.groups);
  isDirty.value = false;
}

function sanitizeGroup(group: ToolCategory) {
  const normalized = normalizeDraftGroup(draftGroups.value[group]);
  if (!areDraftGroupsEqual(draftGroups.value[group], normalized)) {
    draftGroups.value[group] = normalized;
    markDirty();
  }
}

function addType(group: ToolCategory) {
  const nextValue = normalizeToolType(draftInputs.value[group]);
  if (!nextValue) return;

  draftGroups.value[group] = normalizeDraftGroup([
    ...draftGroups.value[group],
    createDraftItem(nextValue),
  ]);
  draftInputs.value[group] = '';
  markDirty();
}

function removeType(group: ToolCategory, index: number) {
  draftGroups.value[group].splice(index, 1);
  markDirty();
}

function toolCountLabel(group: ToolCategory, value: string) {
  return toolCategoryStore.getTypeCount(group, value);
}

function resetDraft() {
  syncDraft();
  draftInputs.value = {
    milling: '',
    turning: '',
    swiss: '',
    other: '',
  };
}

function areDraftGroupsEqual(left: DraftToolTypeItem[], right: DraftToolTypeItem[]) {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const candidate = right[index];
    return candidate && candidate.id === item.id && candidate.value === item.value;
  });
}

async function save() {
  try {
    await toolCategoryStore.save({
      milling: toStoredGroup(draftGroups.value.milling),
      turning: toStoredGroup(draftGroups.value.turning),
      swiss: toStoredGroup(draftGroups.value.swiss),
      other: toStoredGroup(draftGroups.value.other),
    });
    syncDraft();
    toastSuccess('Tool category settings updated.');
  } catch {
    toastError('Unable to save tool category settings.');
  }
}
</script>

<style scoped>
.tool-category-settings {
  padding: 20px;
  background:
    radial-gradient(circle at top right, rgb(var(--v-theme-primary), 0.12), transparent 35%),
    linear-gradient(180deg, rgb(var(--v-theme-surface)) 0%, rgb(var(--v-theme-surface-bright)) 100%);
}

.tool-category-settings__hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.tool-category-settings__title {
  margin: 6px 0 8px;
  font-size: 1.35rem;
  line-height: 1.2;
}

.tool-category-settings__copy {
  margin: 0;
  max-width: 62ch;
}

.tool-category-settings__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tool-category-settings__panel-title {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tool-category-settings__group {
  padding: 16px;
}

.tool-category-settings__group-title {
  font-size: 1rem;
  font-weight: 700;
}

.tool-category-settings__group-copy {
  font-size: 0.92rem;
}

.tool-category-settings__adder {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  margin-bottom: 12px;
}

.tool-category-settings__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tool-category-settings__row {
  display: grid;
  grid-template-columns: 28px auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.tool-category-settings__drag-handle {
  cursor: grab;
}

.tool-category-settings__drag-handle:active {
  cursor: grabbing;
}

.tool-category-settings__index {
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
}

.tool-category-settings__row-actions {
  display: flex;
  align-items: center;
}

.tool-category-settings__count-chip {
  min-width: 28px;
  justify-content: center;
}

.tool-category-settings__row--ghost {
  opacity: 0.45;
}

.tool-category-settings__row--dragging {
  opacity: 0.9;
}

.tool-category-settings__empty {
  padding: 20px 0 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}

@media (max-width: 960px) {
  .tool-category-settings__hero {
    flex-direction: column;
  }

  .tool-category-settings__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .tool-category-settings__panel-title {
    padding-right: 8px;
  }
}

@media (max-width: 600px) {
  .tool-category-settings__adder,
  .tool-category-settings__row {
    grid-template-columns: minmax(0, 1fr);
  }

  .tool-category-settings__index {
    display: none;
  }

  .tool-category-settings__drag-handle {
    justify-self: flex-end;
  }

  .tool-category-settings__row-actions {
    justify-content: flex-end;
  }
}
</style>
