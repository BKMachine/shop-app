<template>
  <v-combobox
    class="mx-2"
    clearable
    :items="locations"
    label="Location"
    :model-value="props.modelValue ?? null"
    @click:clear="updateLocation(null)"
    @update:model-value="updateLocation"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import api from '@/plugins/axios';
import { toastError } from '@/plugins/vue-toast-notification';

const props = defineProps<{
  modelValue?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const locations = ref<string[]>([]);

onMounted(() => {
  api
    .get<string[]>('/parts/locations')
    .then(({ data }) => {
      locations.value = data.sort((left, right) => left.localeCompare(right));
    })
    .catch(() => {
      toastError('Failed to fetch part locations.');
    });
});

function updateLocation(value: unknown) {
  emit('update:modelValue', typeof value === 'string' ? value : null);
}
</script>

<style scoped></style>
