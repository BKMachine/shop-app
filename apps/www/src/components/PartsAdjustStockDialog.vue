<template>
  <v-card-title class="title">{{ part.part }}</v-card-title>
  <v-card-text>
    <v-row>
      <div>{{ title }} <v-switch v-model="set" label="Set" color="secondary"></v-switch></div>
    </v-row>
    <v-row>
      <v-btn @click="adjustment -= 1">-1</v-btn>
      <v-btn @click="adjustment -= 10"> -10</v-btn>
      <v-btn @click="adjustment -= 100">-100</v-btn>
      <v-btn @click="adjustment += 100"> +100</v-btn>
      <v-btn @click="adjustment += 10">+10</v-btn>
      <v-btn @click="adjustment += 1">+1</v-btn>
    </v-row>
    <v-row>
      <v-col cols="9">
        <v-text-field
          v-model.number="adjustment"
          type="number"
          @keydown="isNumber($event)"
        ></v-text-field>
      </v-col>
      <v-col cols="3" class="stock-display align-center d-flex flex-column">
        <v-row>
          {{ part.stock }}
        </v-row>
        <v-row>
          <v-icon icon="mdi-arrow-down"></v-icon>
        </v-row>
        <v-row>
          {{ newStock }}
        </v-row>
      </v-col>
    </v-row>
  </v-card-text>
  <v-card-actions>
    <v-spacer />
    <v-btn
      text="Cancel"
      color="red"
      variant="outlined"
      :disabled="saveFlag"
      @click="emit('closeDialog')"
    ></v-btn>
    <v-btn
      text="Save"
      color="green"
      variant="outlined"
      :disabled="newStock < 0 || saveFlag"
      @click="save"
    ></v-btn>
  </v-card-actions>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { isNumber } from '@/plugins/utils';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();
const props = defineProps<{
  part: PartDoc;
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
  background-color: rgb(var(--v-theme-secondary));
  color: white;
}

.stock-display {
  font-size: 1.5em;
}
</style>
