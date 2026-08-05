<template>
  <v-container class="py-6">
    <v-card class="mx-auto pa-6" max-width="560" rounded="lg" variant="tonal">
      <v-card-title class="text-h5 px-0">Test Actions</v-card-title>
      <v-card-subtitle class="px-0 pb-4">
        Manual triggers for mail reports and other diagnostics.
      </v-card-subtitle>

      <div class="d-flex flex-wrap ga-3">
        <v-btn
          color="primary"
          :loading="sendingDaily"
          prepend-icon="mdi-calendar-today"
          @click="sendJobReport('daily')"
        >
          Send Job Daily
        </v-btn>

        <v-btn
          color="secondary"
          :loading="sendingWeekly"
          prepend-icon="mdi-calendar-week"
          @click="sendJobReport('weekly')"
        >
          Send Job Weekly
        </v-btn>
      </div>

      <v-alert v-if="message" class="mt-5" :type="messageType" variant="tonal">
        {{ message }}
      </v-alert>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import api from '@/plugins/axios';

const sendingDaily = ref(false);
const sendingWeekly = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

async function sendJobReport(period: 'daily' | 'weekly') {
  const loading = period === 'daily' ? sendingDaily : sendingWeekly;
  loading.value = true;
  message.value = '';

  try {
    await api.get(`/mail/job-reports/${period}`);
    messageType.value = 'success';
    message.value = `Sent ${period} job report.`;
  } catch (error) {
    messageType.value = 'error';
    message.value = `Failed to send ${period} job report.`;
    throw error;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.ga-3 {
  gap: 12px;
}
</style>
