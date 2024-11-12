<template>
  <v-dialog v-model="dialog" max-width="600" class="card-height">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn v-bind="activatorProps" class="ml-3" color="grey-lighten-1">
        <v-icon icon="mdi-image-plus-outline" size="large"></v-icon>
      </v-btn>
    </template>

    <template v-slot:default="{ isActive }">
      <v-card>
        <v-toolbar color="primary" title="Image Selector"> </v-toolbar>
        <div class="d-flex flex-row card-height">
          <v-tabs v-model="tab" color="orange" direction="vertical">
            <v-tab prepend-icon="mdi-desktop-classic" text="Desktop" value="pc"></v-tab>
            <v-tab prepend-icon="mdi-camera-outline" text="Webcam" value="cam"></v-tab>
            <v-tab prepend-icon="mdi-history" text="Recent" value="recent"></v-tab>
          </v-tabs>
          <v-divider vertical />
          <v-card-text>
            <v-container>
              <v-row justify="center">{{ helperText }}</v-row>
            </v-container>
            <v-divider />
            <div class="window-container">
              <v-tabs-window v-model="tab" class="window">
                <v-tabs-window-item value="pc">
                  <v-file-input
                    label="Click here to select a file"
                    accept="image/*"
                    prepend-icon=""
                    @change="handleFileChange"
                    @click:clear="clearInputs"
                  >
                    <template v-slot:prepend>
                      <div v-if="imagePreviewUrl" class="preview">
                        <img :src="imagePreviewUrl" alt="Image Preview" />
                      </div>
                      <v-icon
                        v-else
                        icon="mdi-image-outline"
                        size="50"
                        color="grey-darken-2"
                        @click="triggerFileInput"
                      />
                    </template>
                  </v-file-input>
                </v-tabs-window-item>
              </v-tabs-window>
            </div>
          </v-card-text>
        </div>
        <template v-slot:actions>
          <v-btn
            class="ml-auto"
            text="Upload"
            prepend-icon="mdi-upload"
            :disabled="selectedFile === null"
            @click="uploadImage"
          />
          <v-btn text="Close" @click="isActive.value = false" />
        </template>
      </v-card>
    </template>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import api from '@/plugins/axios';

const imagePreviewUrl = ref('');
const tab = ref<'pc' | 'cam' | 'recent'>('pc');
const dialog = ref(true);
const emit = defineEmits(['done']);
const props = defineProps<{
  id: string;
  type: 'tool' | 'part';
}>();

const helperText = computed(() => {
  switch (tab.value) {
    case 'pc':
      return 'Select an image from your local computer.';
    case 'cam':
      return 'Snap a picture with an attached camera.';
    case 'recent':
      return 'Browse recently used images.';
    default:
      return '';
  }
});

function clearInputs() {
  selectedFile.value = null;
  imagePreviewUrl.value = '';
}

const selectedFile = ref();
function handleFileChange(event) {
  const file = event.target.files[0];
  selectedFile.value = file;

  if (file) {
    imagePreviewUrl.value = URL.createObjectURL(file);
  } else {
    imagePreviewUrl.value = '';
  }
}

watch(selectedFile, (newFile, oldFile) => {
  if (oldFile && imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
});

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

<style scoped>
.card-height {
  height: 400px;
}
.window-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
.window {
  width: 100%;
}
.preview {
  height: 100px;
  width: 100px;
  border: 1px solid #969696;
  border-radius: 5px;
}
.preview img {
  width: 100%;
  height: 100%;
}
</style>
