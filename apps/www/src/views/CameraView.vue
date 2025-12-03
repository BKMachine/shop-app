<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Recent uploads</span>
      <v-btn
        size="small"
        variant="text"
        icon="mdi-refresh"
        @click="loadRecent"
        :disabled="loading"
      />
    </v-card-title>

    <v-card-text>
      <div v-if="loading" class="d-flex justify-center my-6">
        <v-progress-circular indeterminate />
      </div>

      <div v-else-if="error" class="text-error">{{ error }}</div>

      <div v-else-if="!images.length" class="text-medium-emphasis">No recent images.</div>

      <v-row v-else dense>
        <v-col v-for="img in images" :key="img.id" cols="6" sm="4" md="3" lg="2">
          <v-card class="pa-1" elevation="1" hover>
            <v-img :src="img.url" aspect-ratio="1" cover />

            <v-card-subtitle class="text-caption mt-1">
              {{ new Date(img.createdAt).toLocaleString() }}
            </v-card-subtitle>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import api from '@/plugins/axios';

const loading = ref(false);
const error = ref('');
const images = ref<RecentImage[]>([]);

onMounted(() => {
  loadRecent();
});

function loadRecent() {
  api.get('/images/uploads/recent').then(({ data }) => {
    images.value = data;
  });
}
</script>

<style></style>
