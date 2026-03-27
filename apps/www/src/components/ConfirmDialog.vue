<template>
  <v-dialog
    :max-width="maxWidth"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <slot>
          {{ message }}
        </slot>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="loading" variant="text" @click="emit('update:modelValue', false)">
          {{ cancelText }}
        </v-btn>
        <v-btn color="error" :loading="loading" variant="flat" @click="emit('confirm')">
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    maxWidth?: number | string;
    loading?: boolean;
  }>(),
  {
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    maxWidth: 500,
    loading: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [boolean];
  confirm: [];
}>();
</script>
