<template>
  <v-card-title class="title">
    <div class="d-flex align-center justify-space-between">
      <span>{{ part.part }}</span>
      <div class="d-flex align-center">
        <span class="mode-label mr-4">{{ set ? 'Set' : 'Adjust' }}</span>
        <v-switch v-model="set" color="white" density="compact" hide-details />
      </div>
    </div>
  </v-card-title>
  <v-card-text class="pa-6">
    <!-- Quick Adjustment Buttons -->
    <div class="mb-2">
      <p class="text-caption text-uppercase font-weight-bold opacity-75 mb-2">
        {{ set ? 'Quick Set' : 'Quick Adjust' }}
      </p>
      <div class="button-group">
        <div class="button-grid">
          <v-btn
            class="adjust-btn decrease"
            color="error"
            size="small"
            variant="tonal"
            @click="adjustment -= 100"
          >
            −100
          </v-btn>
          <v-btn
            class="adjust-btn decrease"
            color="error"
            size="small"
            variant="tonal"
            @click="adjustment -= 10"
          >
            −10
          </v-btn>
          <v-btn
            class="adjust-btn decrease"
            color="error"
            size="small"
            variant="tonal"
            @click="adjustment -= 1"
          >
            −1
          </v-btn>
          <v-btn
            class="adjust-btn increase"
            color="success"
            size="small"
            variant="tonal"
            @click="adjustment += 1"
          >
            +1
          </v-btn>
          <v-btn
            class="adjust-btn increase"
            color="success"
            size="small"
            variant="tonal"
            @click="adjustment += 10"
          >
            +10
          </v-btn>
          <v-btn
            class="adjust-btn increase"
            color="success"
            size="small"
            variant="tonal"
            @click="adjustment += 100"
          >
            +100
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Input and Stock Display -->
    <div class="stock-section">
      <div class="text-caption text-uppercase font-weight-bold opacity-75 mb-2 mt-8">
        {{ set ? 'New Stock' : 'Adjustment' }}
      </div>
      <v-row>
        <v-col cols="8">
          <v-text-field
            v-model.number="adjustment"
            density="compact"
            :prefix="set ? '' : adjustment > 0 ? '+' : ''"
            type="number"
            variant="outlined"
            @keydown="isNumber($event)"
          />
        </v-col>
        <v-col class="d-flex flex-column justify-center" cols="4">
          <div class="stock-display-card">
            <div class="stock-value">
              <p class="text-caption opacity-75">Current</p>
              <p class="current-stock">{{ part.stock }}</p>
            </div>
            <v-icon class="transition-arrow" color="#8b5cf6" size="x-large">
              mdi-arrow-down
            </v-icon>
            <div class="stock-value">
              <p class="text-caption opacity-75">New</p>
              <p
                class="new-stock"
                :class="{
                  'text-error': newStock < 0,
                  'text-success': newStock > part.stock && !set,
                  'text-orange': newStock < part.stock && !set,
                }"
              >
                {{ newStock }}
              </p>
            </div>
          </div>
        </v-col>
      </v-row>
    </div>
  </v-card-text>
  <v-card-actions class="pa-4">
    <v-spacer />
    <v-btn
      color="default"
      :disabled="saveFlag"
      text="Cancel"
      variant="text"
      @click="emit('closeDialog')"
    />
    <v-btn
      color="success"
      :disabled="newStock < 0 || saveFlag"
      text="Save"
      variant="elevated"
      @click="save"
    />
  </v-card-actions>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { isNumber } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();
const props = defineProps<{
  part: Part;
}>();
const emit = defineEmits(['closeDialog']);
const saveFlag = ref(false);

const adjustment = ref(0);
const newStock = computed(() => {
  if (set.value) {
    return adjustment.value;
  } else {
    return props.part.stock + adjustment.value;
  }
});
const set = ref(false);

const title = computed(() => {
  return set.value ? 'Set Stock' : 'Adjust Stock';
});

async function save() {
  saveFlag.value = true;
  const clone = { ...props.part };
  clone.stock = newStock.value;
  await partStore
    .update(clone)
    .then(() => {
      toastSuccess('Part updated successfully');
      emit('closeDialog');
    })
    .catch(() => {
      toastError('Unable to update part');
    });
  saveFlag.value = false;
}
</script>

<style scoped>
.title {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-weight: 600;
}

.mode-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  min-width: 60px;
  text-align: right;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.adjust-btn {
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
}

.stock-section {
  border-radius: 8px;
  /* padding: 16px; */
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(139, 92, 246, 0.02) 100%);
}

.stock-display-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: #f8f7ff;
  border-radius: 8px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  text-align: center;
}

.stock-value {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.current-stock {
  font-size: 1.25em;
  font-weight: 600;
  color: #6366f1;
}

.new-stock {
  font-size: 1.5em;
  font-weight: 700;
  color: #6366f1;
}

.transition-arrow {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(6px);
  }
}
</style>
