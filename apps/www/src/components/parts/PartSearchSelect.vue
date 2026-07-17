<template>
  <v-autocomplete
    v-bind="attrs"
    v-model="selectedPartId"
    v-model:search="searchTerm"
    clearable
    item-title="label"
    item-value="value"
    :items="options"
    :label="label"
    :loading="loading"
    no-filter
    placeholder="Start typing to search parts"
    variant="outlined"
  >
    <template #item="{ props, item }">
      <v-list-item
        v-bind="props"
        :subtitle="optionFromSlot(item).description"
        :title="optionFromSlot(item).part"
      >
        <template #append>
          <span class="part-option-stock">{{ optionFromSlot(item).stock }}</span>
        </template>
      </v-list-item>
    </template>

    <template #selection="{ item }">
      <div class="part-selection">
        <span class="part-selection__part">{{ item.part }}</span>
        <span v-if="item.description" class="part-selection__description">
          {{ item.description }}
        </span>
      </div>
    </template>

    <template #append-inner>
      <v-btn
        color="primary"
        :disabled="!selectedPartId"
        icon="mdi-open-in-app"
        size="small"
        variant="text"
        @click.stop="openSelectedPart"
        @mousedown.stop.prevent
      />
    </template>

    <template #details>
      <div v-if="selectedPartOption" class="part-selection-hint">
        <span>Stock:</span>
        <span class="part-selection-hint__stock">{{ selectedPartOption.stock }}</span>
        <span class="part-selection-hint__divider">|</span>
        <span>{{ selectedPartOption.location || '-' }}</span>
        <span class="part-selection-hint__divider">|</span>
        <span>{{ selectedPartOption.position || '-' }}</span>
      </div>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue';
import api from '@/plugins/axios';
import router from '@/router';

type PartOption = {
  value: string;
  part: string;
  description: string;
  label: string;
  stock: number;
  location: string;
  position: string;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string | Part | null;
    customerId?: string | Customer | null;
    label?: string;
  }>(),
  {
    modelValue: null,
    customerId: null,
    label: 'Part',
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: string | null) => void>();

const attrs = useAttrs();
const options = ref<PartOption[]>([]);
const loading = ref(false);
const searchTerm = ref('');
const requestId = ref(0);
let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;

const selectedPartId = computed({
  get: () => {
    if (!props.modelValue) return null;
    return typeof props.modelValue === 'string' ? props.modelValue : props.modelValue._id;
  },
  set: (value: string | null) => {
    emit('update:modelValue', value);
  },
});

const normalizedCustomerId = computed(() => {
  if (!props.customerId) return null;
  return typeof props.customerId === 'string' ? props.customerId : props.customerId._id;
});

const selectedPartOption = computed(() => {
  return options.value.find((option) => option.value === selectedPartId.value) || null;
});

function createOption(
  part: Pick<Part, '_id' | 'part' | 'description' | 'stock' | 'location' | 'position'>,
): PartOption {
  return {
    value: part._id,
    part: part.part?.trim() || '',
    description: part.description?.trim() || '',
    label: [part.part?.trim() || '', part.description?.trim() || ''].filter(Boolean).join(' - '),
    stock: Math.max(0, Number(part.stock) || 0),
    location: part.location?.trim() || '',
    position: part.position?.trim() || '',
  };
}

function optionFromSlot(item: unknown): PartOption {
  const candidate =
    item && typeof item === 'object' && 'raw' in item
      ? (item as { raw?: PartOption }).raw
      : (item as PartOption | undefined);

  return {
    value: candidate?.value || '',
    part: candidate?.part || '',
    description: candidate?.description || '',
    label: candidate?.label || '',
    stock: Math.max(0, Number(candidate?.stock) || 0),
    location: candidate?.location || '',
    position: candidate?.position || '',
  };
}

function upsertOption(nextOption: PartOption) {
  options.value = [
    nextOption,
    ...options.value.filter((candidate) => candidate.value !== nextOption.value),
  ];
}

async function ensureSelectedPartLoaded() {
  const partId = selectedPartId.value;
  if (!partId || options.value.some((option) => option.value === partId)) return;

  try {
    const { data } = await api.get<Part>(`/parts/${partId}`);
    upsertOption(createOption(data));
  } catch {
    // Keep the field empty if the current part cannot be loaded.
  }
}

async function loadSearchResults(search: string) {
  const trimmedSearch = search.trim();
  if (trimmedSearch.length < 2) {
    options.value = selectedPartId.value
      ? options.value.filter((option) => option.value === selectedPartId.value)
      : [];
    loading.value = false;
    return;
  }

  const nextRequestId = ++requestId.value;
  loading.value = true;

  try {
    const { data } = await api.get<PartListResponse>('/parts', {
      params: {
        search: trimmedSearch,
        customer: normalizedCustomerId.value || undefined,
        includeSubcomponents: true,
        limit: 20,
        sort: 'part',
        order: 'asc',
      },
    });

    if (requestId.value !== nextRequestId) return;

    const nextOptions = data.items.map((item) =>
      createOption({
        _id: item._id,
        part: item.part,
        description: item.description,
        stock: item.stock,
        location: item.location,
        position: item.position,
      } as Pick<Part, '_id' | 'part' | 'description' | 'stock' | 'location' | 'position'>),
    );

    if (selectedPartId.value) {
      const selectedOption = options.value.find((option) => option.value === selectedPartId.value);
      options.value = selectedOption
        ? [selectedOption, ...nextOptions.filter((option) => option.value !== selectedOption.value)]
        : nextOptions;
      return;
    }

    options.value = nextOptions;
  } catch {
    if (requestId.value === nextRequestId) {
      options.value = selectedPartId.value
        ? options.value.filter((option) => option.value === selectedPartId.value)
        : [];
    }
  } finally {
    if (requestId.value === nextRequestId) {
      loading.value = false;
    }
  }
}

function openSelectedPart() {
  if (!selectedPartId.value) return;
  void router.push({ name: 'viewPart', params: { id: selectedPartId.value } });
}

watch(
  () => selectedPartId.value,
  () => {
    void ensureSelectedPartLoaded();
  },
  { immediate: true },
);

watch(
  () => searchTerm.value,
  (value) => {
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
    }

    searchTimeoutId = setTimeout(() => {
      void loadSearchResults(value);
    }, 200);
  },
);

watch(
  () => normalizedCustomerId.value,
  () => {
    if (!searchTerm.value.trim()) return;
    void loadSearchResults(searchTerm.value);
  },
);

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId);
  }
});
</script>

<style scoped>
.part-selection {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.part-selection__part {
  font-weight: 600;
}

.part-selection__description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.6);
}

.part-selection-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  /* min-height: 22px; */
  font-size: 0.78rem;
  color: rgba(0, 0, 0, 0.68);
  white-space: nowrap;
}

.part-selection-hint__stock {
  font-weight: 800;
}

.part-selection-hint__divider {
  margin: 0 4px 0 8px;
  color: rgba(0, 0, 0, 0.42);
}

.part-option-stock {
  min-width: 3ch;
  text-align: right;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.68);
}
</style>
