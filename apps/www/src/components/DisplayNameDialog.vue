<template>
  <v-dialog v-model="displayNameDialogState.open" max-width="540" persistent>
    <v-card>
      <v-card-title class="d-flex align-center ga-2 py-4">
        <v-icon color="warning">mdi-monitor-edit</v-icon>
        Set Device Display Name
      </v-card-title>

      <v-divider />

      <v-card-text class="pt-5">
        <p class="text-medium-emphasis mb-4">{{ displayNameDialogState.reason }}</p>

        <v-text-field
          v-model="displayName"
          :disabled="saving"
          :error-messages="errorMessage ? [errorMessage] : []"
          label="Display Name"
          maxlength="60"
          placeholder="Shop Front PC"
          @keyup.enter="onSave"
        />
      </v-card-text>

      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn :disabled="saving" variant="text" @click="closeDisplayNameDialog">Later</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { AxiosError } from 'axios';
import { ref } from 'vue';
import api, { getOrCreateDeviceId } from '@/plugins/axios';
import { closeDisplayNameDialog, displayNameDialogState } from '@/state/displayNameDialog';

const displayName = ref(localStorage.getItem('shop-device-display-name') ?? '');
const saving = ref(false);
const errorMessage = ref('');

async function onSave() {
  const normalizedName = displayName.value.trim();
  errorMessage.value = '';

  if (!normalizedName) {
    errorMessage.value = 'Display name is required.';
    return;
  }

  saving.value = true;
  try {
    await api.post('/devices/register', {
      deviceId: getOrCreateDeviceId(),
      displayName: normalizedName,
    });

    localStorage.setItem('shop-device-display-name', normalizedName);
    closeDisplayNameDialog();
  } catch (error) {
    const responseMessage =
      (error as AxiosError<{ message?: string }>).response?.data?.message ||
      'Failed to save display name. Please try again.';
    errorMessage.value = responseMessage;
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped></style>
