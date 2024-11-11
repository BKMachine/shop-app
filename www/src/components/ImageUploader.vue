<template>
  <v-dialog v-model="dialog" max-width="500">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn v-bind="activatorProps" class="ml-3" color="grey-lighten-1">
        <v-icon icon="mdi-upload"></v-icon>
      </v-btn>
    </template>

    <template v-slot:default="{ isActive }">
      <v-card>
        <v-card-text>
          <v-file-input
            :label="placeholderText"
            accept="image/*"
            @change="handleFileChange"
          ></v-file-input>
        </v-card-text>
        <template v-slot:actions>
          <v-btn
            class="ml-auto"
            text="Upload"
            prepend-icon="mdi-upload"
            :disabled="!selectedFile"
            @click="uploadImage"
          ></v-btn>
          <v-btn text="Close" @click="isActive.value = false"></v-btn>
        </template>
      </v-card>
    </template>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { capitalizeFirstLetter } from '@/plugins/utils';

const dialog = ref(false);
const emit = defineEmits(['done']);
const props = defineProps<{
  id: string;
  type: 'tool' | 'part';
}>();

const placeholderText = computed(() => {
  return `Upload ${capitalizeFirstLetter(props.type)} Image`;
});
const selectedFile = ref();
function handleFileChange(event) {
  selectedFile.value = event.target.files[0];
}

async function uploadImage() {
  const formData = new FormData();
  formData.append('id', props.id);
  formData.append('type', props.type);
  formData.append('image', selectedFile.value);

  await api
    .post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    .then(({ data }) => {
      emit('done', data.url);
      dialog.value = false;
    });
}
</script>

<style scoped></style>
