<template>
  <div class="part-notes-details">
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h3 class="text-h6">Setup Notes</h3>
        <p class="text-medium-emphasis text-body-2">{{ noteCountLabel }}</p>
      </div>

      <v-btn
        color="primary"
        :disabled="!part._id"
        prepend-icon="mdi-note-plus-outline"
        variant="elevated"
        @click="openCreateDialog"
      >
        Add Note
      </v-btn>
    </div>

    <v-alert v-if="!part._id" type="info" variant="tonal">
      Save this part first, then you can add setup notes.
    </v-alert>

    <v-card v-else>
      <v-card-text>
        <div class="d-flex align-center ga-2 mb-4">
          <v-chip
            v-for="option in filterOptions"
            :key="option.value"
            class="notes-filter-chip"
            :color="
              activeFilter === option.value
                ? option.value === 'all'
                  ? 'purple'
                  : option.color
                : undefined
            "
            :variant="activeFilter === option.value ? 'elevated' : 'outlined'"
            @click="activeFilter = option.value"
          >
            <v-icon v-if="option.icon" class="mr-1" :icon="option.icon" start />
            {{ option.label }}
          </v-chip>
        </div>

        <div v-if="loading" class="d-flex justify-center my-6">
          <v-progress-circular indeterminate />
        </div>

        <div v-else-if="error" class="text-error">{{ error }}</div>

        <div v-else-if="!filteredNotes.length" class="text-medium-emphasis py-4">
          No notes yet. Add setup reminders or mark something critical for the next run.
        </div>

        <div v-else class="notes-list">
          <v-card
            v-for="note in filteredNotes"
            :key="note.id"
            class="note-card"
            :class="`note-card--${note.priority}`"
            variant="outlined"
          >
            <div class="note-card__header">
              <div class="d-flex align-center ga-3">
                <div
                  class="note-card__priority-marker"
                  :class="`note-card__priority-marker--${note.priority}`"
                />
                <v-chip
                  :color="priorityMeta[note.priority].color"
                  :prepend-icon="priorityMeta[note.priority].icon"
                  size="small"
                  variant="elevated"
                >
                  {{ priorityMeta[note.priority].label }}
                </v-chip>
                <div class="note-card__timestamp text-caption">{{ formatNoteTimestamp(note) }}</div>
              </div>

              <div class="note-card__actions">
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="openEditDialog(note)"
                />
                <v-btn
                  color="error"
                  icon="mdi-delete"
                  :loading="deletingId === note.id"
                  size="small"
                  variant="text"
                  @click="confirmDeleteNote(note)"
                />
              </div>
            </div>

            <div class="note-card__body">
              <template v-for="(segment, index) in highlightNoteText(note.text)" :key="index">
                <span v-if="segment.isDimension" class="note-card__dimension">
                  {{ segment.text }}
                </span>
                <span v-else>{{ segment.text }}</span>
              </template>
            </div>

            <div class="note-card__footer text-caption">
              <span class="note-card__meta-pill">
                <v-icon icon="mdi-account-circle-outline" size="14" start />
                {{ note.createdByDisplayName }}
              </span>
              <span v-if="wasEdited(note)" class="note-card__meta-pill">
                <v-icon icon="mdi-pencil-circle-outline" size="14" start />
                {{ note.updatedByDisplayName }}
              </span>
            </div>
          </v-card>
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="editorOpen" max-width="760">
      <v-card class="note-editor">
        <div class="note-editor__hero" :class="`note-editor__hero--${editorPriority}`">
          <div class="note-editor__hero-top">
            <div>
              <div class="note-editor__eyebrow">Setup Note</div>
              <div class="note-editor__title">{{ editingNote ? 'Edit Note' : 'Add Note' }}</div>
            </div>
            <v-chip
              :color="priorityMeta[editorPriority].color"
              :prepend-icon="priorityMeta[editorPriority].icon"
              size="small"
              variant="elevated"
            >
              {{ priorityMeta[editorPriority].label }}
            </v-chip>
          </div>
          <div class="note-editor__subtitle">
            Capture setup risks, repeat issues, or helpful context for the next person.
          </div>
        </div>

        <v-card-text class="note-editor__body">
          <div class="note-editor__priority-row">
            <button
              v-for="item in priorityItems"
              :key="item.value"
              class="note-editor__priority-choice"
              :class="[
                `note-editor__priority-choice--${item.value}`,
                { 'note-editor__priority-choice--active': editorPriority === item.value },
              ]"
              type="button"
              @click="editorPriority = item.value"
            >
              <v-icon :icon="priorityMeta[item.value].icon" size="18" />
              <span>{{ item.label }}</span>
            </button>
          </div>

          <v-textarea
            v-model="editorText"
            auto-grow
            class="note-editor__textarea"
            counter
            label="Note"
            placeholder="Example: Verify jaw stop position before op 2. Critical clamp clearance near the fixture corner."
            rows="5"
          />
        </v-card-text>
        <v-card-actions class="note-editor__actions">
          <v-spacer />
          <v-btn variant="text" @click="closeEditor">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!editorText.trim()"
            :loading="saving"
            variant="elevated"
            @click="saveNote"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="deleteConfirmVisible"
      confirm-text="Delete"
      :loading="Boolean(deleteTarget && deletingId === deleteTarget.id)"
      title="Delete Note?"
      @confirm="deleteConfirmedNote"
    >
      This will permanently remove the note from this part.
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

const emit = defineEmits<{
  'notes-changed': [];
}>();

const partStore = usePartStore();

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notes = ref<MyPartNoteData[]>([]);
const activeFilter = ref<'all' | 'critical' | 'default'>('all');
const editorOpen = ref(false);
const editingNote = ref<MyPartNoteData | null>(null);
const editorText = ref('');
const editorPriority = ref<'critical' | 'default'>('default');
const deletingId = ref('');
const deleteConfirmVisible = ref(false);
const deleteTarget = ref<MyPartNoteData | null>(null);

const priorityMeta = {
  critical: { label: 'Critical', color: 'error', icon: 'mdi-alert-octagon', order: 0 },
  default: { label: 'Default', color: 'primary', icon: 'mdi-flag-outline', order: 1 },
} as const;

const filterOptions = [
  { value: 'all', label: 'All', color: 'secondary', icon: 'mdi-format-list-bulleted' },
  { value: 'critical', label: 'Critical', color: 'error', icon: 'mdi-alert-octagon' },
  { value: 'default', label: 'Default', color: 'primary', icon: 'mdi-flag-outline' },
] as const;

const priorityItems = [
  { value: 'critical', label: 'Critical' },
  { value: 'default', label: 'Default' },
] as const;

const sortedNotes = computed(() => {
  return [...notes.value].sort((a, b) => {
    const priorityDiff = priorityMeta[a.priority].order - priorityMeta[b.priority].order;
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
});

const filteredNotes = computed(() => {
  if (activeFilter.value === 'all') return sortedNotes.value;
  return sortedNotes.value.filter((note) => note.priority === activeFilter.value);
});

const noteCountLabel = computed(() => {
  const count = notes.value.length;
  return count === 1 ? '1 note' : `${count} notes`;
});

function formatNoteTimestamp(note: MyPartNoteData) {
  const updated = new Date(note.updatedAt).toLocaleString();
  if (!wasEdited(note)) return `Created ${updated}`;
  return `Updated ${updated}`;
}

function wasEdited(note: MyPartNoteData) {
  return note.createdAt !== note.updatedAt;
}

function highlightNoteText(text: string) {
  const dimensionPattern = /(?<![\d.])(\d+\.\d+)(?![\d.])/g;
  const segments: { text: string; isDimension: boolean }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(dimensionPattern)) {
    const start = match.index ?? 0;
    const value = match[0];

    if (start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, start),
        isDimension: false,
      });
    }

    segments.push({
      text: value,
      isDimension: true,
    });

    lastIndex = start + value.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isDimension: false,
    });
  }

  return segments.length > 0 ? segments : [{ text, isDimension: false }];
}

function openCreateDialog() {
  editingNote.value = null;
  editorText.value = '';
  editorPriority.value = 'default';
  editorOpen.value = true;
}

function openEditDialog(note: MyPartNoteData) {
  editingNote.value = note;
  editorText.value = note.text;
  editorPriority.value = note.priority;
  editorOpen.value = true;
}

function closeEditor() {
  if (saving.value) return;
  editorOpen.value = false;
  editingNote.value = null;
  editorText.value = '';
  editorPriority.value = 'default';
}

async function saveNote() {
  if (!props.part._id || !editorText.value.trim()) return;

  saving.value = true;
  error.value = '';

  try {
    if (editingNote.value) {
      await partStore.updatePartNote(props.part._id, editingNote.value.id, {
        text: editorText.value,
        priority: editorPriority.value,
      });
      toastSuccess('Note updated successfully');
    } else {
      await partStore.createPartNote(props.part._id, {
        text: editorText.value,
        priority: editorPriority.value,
      });
      toastSuccess('Note added successfully');
    }

    editorOpen.value = false;
    editingNote.value = null;
    editorText.value = '';
    editorPriority.value = 'default';
    notes.value = partStore.getPartNotes(props.part._id);
    emit('notes-changed');
  } catch (err) {
    error.value = 'Failed to save note.';
    console.error(err);
    toastError('Failed to save note');
  } finally {
    saving.value = false;
  }
}

function confirmDeleteNote(note: MyPartNoteData) {
  deleteTarget.value = note;
  deleteConfirmVisible.value = true;
}

async function deleteConfirmedNote() {
  if (!deleteTarget.value || !props.part._id) return;

  deletingId.value = deleteTarget.value.id;
  error.value = '';

  try {
    await partStore.deletePartNote(props.part._id, deleteTarget.value.id);
    toastSuccess('Note deleted successfully');
    deleteConfirmVisible.value = false;
    deleteTarget.value = null;
    notes.value = partStore.getPartNotes(props.part._id);
    emit('notes-changed');
  } catch (err) {
    error.value = 'Failed to delete note.';
    console.error(err);
    toastError('Failed to delete note');
  } finally {
    deletingId.value = '';
  }
}

async function loadNotes() {
  if (!props.part._id) {
    notes.value = [];
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    notes.value = await partStore.loadPartNotes(props.part._id);
  } catch (err) {
    error.value = 'Failed to load notes.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.part._id,
  () => {
    loadNotes();
  },
  { immediate: true },
);
</script>

<style scoped>
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.notes-filter-chip {
  font-weight: 600;
}

.note-card {
  position: relative;
  padding: 1rem;
  border-width: 1px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.note-card--critical {
  border-left: 4px solid rgb(var(--v-theme-error));
  background:
    linear-gradient(
      90deg,
      rgba(var(--v-theme-error), 0.08),
      rgba(var(--v-theme-error), 0.015) 22%,
      transparent 55%
    ),
    #fff;
}

.note-card--default {
  border-left: 4px solid rgb(var(--v-theme-primary));
  background:
    linear-gradient(
      90deg,
      rgba(var(--v-theme-primary), 0.08),
      rgba(var(--v-theme-primary), 0.015) 22%,
      transparent 55%
    ),
    #fff;
}

.note-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.note-card__priority-marker {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.7);
}

.note-card__priority-marker--critical {
  background: rgb(var(--v-theme-error));
}

.note-card__priority-marker--default {
  background: rgb(var(--v-theme-primary));
}

.note-card__timestamp {
  font-weight: 600;
  letter-spacing: 0.01em;
}

.note-card__actions {
  display: flex;
  align-items: center;
}

.note-card__body {
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 0.98rem;
}

.note-card__dimension {
  display: inline-block;
  margin: 0 0.08rem;
  padding: 0.05rem 0.38rem;
  border-radius: 0.4rem;
  background: rgba(250, 204, 21, 0.22);
  box-shadow: inset 0 0 0 1px rgba(202, 138, 4, 0.18);
  color: #854d0e;
  font-weight: 700;
}

.note-card__footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.85rem;
  color: rgba(15, 23, 42, 0.68);
}

.note-card__meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
}

.note-editor {
  overflow: hidden;
  border-radius: 18px;
}

.note-editor__hero {
  padding: 1rem 1.25rem 1.1rem;
  color: white;
  background: linear-gradient(135deg, #334155, #0f172a);
}

.note-editor__hero--critical {
  background: linear-gradient(135deg, rgb(var(--v-theme-error)), #7f1d1d);
}

.note-editor__hero--default {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), #1d4ed8);
}

.note-editor__hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.note-editor__eyebrow {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.82;
}

.note-editor__title {
  font-size: 1.35rem;
  font-weight: 700;
}

.note-editor__subtitle {
  max-width: 48rem;
  margin-top: 0.55rem;
  font-size: 0.95rem;
  line-height: 1.45;
  opacity: 0.92;
}

.note-editor__body {
  padding: 1rem 1.25rem 0.5rem;
  background:
    radial-gradient(circle at top right, rgba(148, 163, 184, 0.12), transparent 28%),
    linear-gradient(180deg, #f8fafc, #fff);
}

.note-editor__priority-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.note-editor__priority-choice {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  background: white;
  color: #0f172a;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.note-editor__priority-choice--active {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.note-editor__priority-choice--critical.note-editor__priority-choice--active {
  border-color: rgba(var(--v-theme-error), 0.5);
  background: rgba(var(--v-theme-error), 0.09);
  color: rgb(var(--v-theme-error));
}

.note-editor__priority-choice--default.note-editor__priority-choice--active {
  border-color: rgba(var(--v-theme-primary), 0.5);
  background: rgba(var(--v-theme-primary), 0.09);
  color: rgb(var(--v-theme-primary));
}

.note-editor__textarea {
  margin-top: 0.25rem;
}

.note-editor__actions {
  padding: 0.75rem 1.25rem 1.1rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0), #f8fafc);
}
</style>
