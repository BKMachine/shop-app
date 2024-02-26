<template>
  <v-dialog v-model="dialog">
    <v-card>
      <v-card-title>
        Edit <span class="type">{{ type }}</span>
      </v-card-title>
      <v-card-text> </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  type: string;
  isImg: boolean;
}>();

const dialog = ref(false);
</script>

<style scoped>
.type {
  text-transform: capitalize;
}
</style>
