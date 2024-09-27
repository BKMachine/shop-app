<template>
  <v-card-title class="d-flex justify-space-between">
    <div>{{ title }} <v-switch v-model="set" label="Set" color="secondary"></v-switch></div>
    <div>{{ part.part }}</div>
  </v-card-title>
  <v-card-text>
    <v-row>
      <v-col cols="9">
        <v-text-field v-model="adjustment" type="number" @keydown="isNumber($event)"></v-text-field>
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { isNumber } from '@/plugins/utils';

const props = defineProps<{
  part: PartDoc;
}>();

const adjustment = ref('0');
const newStock = computed(() => {
  if (set.value) {
    return adjustment.value;
  } else {
    return props.part.stock + parseInt(adjustment.value);
  }
});
const set = ref(false);

const title = computed(() => {
  return set.value ? 'Set Stock' : 'Adjust Stock';
});
</script>

<style scoped>
.stock-display {
  font-size: 1.5em;
}
</style>
