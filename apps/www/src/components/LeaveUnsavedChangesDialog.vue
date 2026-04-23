<template>
  <v-dialog
    max-width="600"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="leave-dialog-title">Unsaved Changes Detected</v-card-title>
      <v-card-text>
        <div class="leave-dialog-subtitle">Save these changes before leaving this page?</div>
        <ul v-if="changes.length" class="leave-changes-list">
          <li v-for="field in changes" :key="field.label" class="leave-changes-item">
            <div class="leave-changes-row">
              <div class="leave-changes-label-group">
                <span>{{ field.label }}</span>
                <span v-if="field.blockReason" class="leave-changes-status"
                  >{{ field.blockReason }}</span
                >
              </div>
              <span class="leave-changes-value">{{ field.value }}</span>
            </div>
          </li>
        </ul>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="loading"
          type="button"
          variant="text"
          @click="emit('update:modelValue', false)"
        >
          Go Back
        </v-btn>
        <v-btn
          color="error"
          :disabled="loading"
          type="button"
          variant="text"
          @click="emit('discard')"
        >
          Leave Without Saving
        </v-btn>
        <v-btn
          color="green"
          :disabled="confirmDisabled"
          :loading="loading"
          type="button"
          variant="flat"
          @click="emit('confirm')"
        >
          Save and Continue
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  changes: Array<{ label: string; value: string; blockReason?: string }>;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  confirm: [];
  discard: [];
}>();
</script>

<style scoped>
.leave-dialog-title {
  color: #b3261e;
}

.leave-dialog-subtitle {
  margin-bottom: 0.9rem;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.leave-changes-list {
  margin: 0;
  padding-left: 1.25rem;
}

.leave-changes-item {
  padding: 0.35rem 0.6rem;
}

.leave-changes-item:nth-child(odd) {
  background: #f2f2f2;
}

.leave-changes-item:nth-child(even) {
  background: #e2e2e2;
}

.leave-changes-row {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.leave-changes-label-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.leave-changes-status {
  color: #b3261e;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
}

.leave-changes-value {
  min-width: 8rem;
  text-align: right;
}
</style>
