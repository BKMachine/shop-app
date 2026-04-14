<template>
  <v-combobox v-model="model" class="mr-2" :items="locations" label="Location" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import api from '@/plugins/axios';
import { toastError } from '@/plugins/vue-toast-notification';

const model = defineModel<string>();

const locations = ref(<string[]>[]);

onMounted(() => {
  getToolLocations();
});

function getToolLocations() {
  api
    .get<string[]>('/tools/locations')
    .then(({ data }) => {
      locations.value = data.sort((a, b) => a.localeCompare(b));
    })
    .catch((e) => {
      toastError('Failed to fetch tool locations.');
    });
}
</script>

<style scoped></style>
