<template>
  <v-row dense>
    <v-col cols="12" md="6">
      <CustomerSelect v-model="draft.customer" clearable label="Customer" :rules="[requiredRule]" />
    </v-col>
    <v-col cols="12" md="6">
      <PartSearchSelect
        v-model="draft.part"
        clearable
        :customer-id="draft.customer"
        label="Part"
        :rules="[requiredRule]"
      />
    </v-col>
    <v-col cols="12" md="8">
      <v-row dense>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="draft.qty"
            label="Qty"
            min="1"
            :rules="[requiredRule, qtyRule]"
            type="number"
            variant="outlined"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="draft.status"
            item-title="title"
            item-value="value"
            :items="statusOptions"
            label="Status"
            variant="outlined"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="draft.priority"
            item-title="title"
            item-value="value"
            :items="priorityOptions"
            label="Priority"
            variant="outlined"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="draft.customerPo" label="Customer PO" variant="outlined" />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="draft.dueDate" label="Due Date" type="date" variant="outlined" />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="draft.startedOn"
            label="Started On"
            type="date"
            variant="outlined"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="draft.completedOn"
            :disabled="draft.status !== 'closed'"
            label="Completed On"
            type="date"
            variant="outlined"
          />
        </v-col>
      </v-row>
    </v-col>
    <v-col cols="12" md="4">
      <div class="part-preview">
        <div class="part-preview__frame">
          <v-progress-circular v-if="loadingPart" color="primary" indeterminate size="32" />
          <img
            v-else-if="selectedPart?.img"
            alt=""
            class="part-preview__image"
            :src="selectedPart.img"
          />
          <MissingImage v-else class="part-preview__image part-preview__fallback" />
        </div>
      </div>
    </v-col>
    <v-col cols="12">
      <v-textarea v-model="draft.notes" label="Notes" rows="4" variant="outlined" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import CustomerSelect from '@/components/CustomerSelect.vue';
import MissingImage from '@/components/MissingImage.vue';
import PartSearchSelect from '@/components/parts/PartSearchSelect.vue';
import api from '@/plugins/axios';

export type JobDraft = {
  customer: string | null;
  part: string | null;
  qty: string;
  status: JobStatus;
  dueDate: string;
  startedOn: string;
  completedOn: string;
  customerPo: string;
  priority: JobPriority;
  notes: string;
};

const props = defineProps<{
  modelValue: JobDraft;
}>();

const emit = defineEmits<(e: 'update:modelValue', value: JobDraft) => void>();

const draft = computed({
  get: () => props.modelValue,
  set: (value: JobDraft) => emit('update:modelValue', value),
});
const selectedPart = ref<Part | null>(null);
const loadingPart = ref(false);
let partRequestId = 0;

const statusOptions = [
  { title: 'Open', value: 'open' },
  { title: 'In Process', value: 'in_process' },
  { title: 'Closed', value: 'closed' },
];

const priorityOptions = [
  { title: 'Low', value: 'low' },
  { title: 'Normal', value: 'normal' },
  { title: 'Rush', value: 'rush' },
];

const requiredRule = (value: unknown) => {
  if (typeof value === 'string') return Boolean(value.trim()) || 'Required';
  return Boolean(value) || 'Required';
};

const qtyRule = (value: unknown) => {
  return Math.max(0, Number(value) || 0) >= 1 || 'Qty must be at least 1';
};

function currentDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadSelectedPart(partId: string | null) {
  if (!partId) {
    selectedPart.value = null;
    loadingPart.value = false;
    return;
  }

  const requestId = ++partRequestId;
  loadingPart.value = true;

  try {
    const { data } = await api.get<Part>(`/parts/${partId}`);
    if (requestId !== partRequestId) return;
    selectedPart.value = data;
  } catch {
    if (requestId !== partRequestId) return;
    selectedPart.value = null;
  } finally {
    if (requestId === partRequestId) {
      loadingPart.value = false;
    }
  }
}

watch(
  () => draft.value.customer,
  (nextValue, previousValue) => {
    if (nextValue !== previousValue) {
      selectedPart.value = null;
      draft.value = {
        ...draft.value,
        part: null,
      };
    }
  },
);

watch(
  () => draft.value.part,
  (value) => {
    void loadSelectedPart(value);
  },
  { immediate: true },
);

watch(
  () => draft.value.status,
  (value) => {
    if (value === 'in_process' && !draft.value.startedOn) {
      draft.value = {
        ...draft.value,
        startedOn: currentDateInputValue(),
      };
      return;
    }

    if (value === 'closed' && !draft.value.completedOn) {
      draft.value = {
        ...draft.value,
        completedOn: currentDateInputValue(),
      };
      return;
    }

    if (value !== 'closed' && draft.value.completedOn) {
      draft.value = {
        ...draft.value,
        completedOn: '',
      };
    }
  },
);
</script>

<style scoped>
.part-preview {
  --job-form-input-details-height: 28px;
  display: flex;
  flex-direction: column;
  height: calc(100% - var(--job-form-input-details-height) + 6px);
}

.part-preview__frame {
  align-items: center;
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 12px;
  display: flex;
  height: 150px;
  justify-content: center;
  overflow: hidden;
  padding: 12px;
  width: 100%;
}

.part-preview__image {
  display: block;
  height: auto;
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  width: auto;
}

.part-preview__fallback {
  height: 100%;
  width: 100%;
}
</style>
