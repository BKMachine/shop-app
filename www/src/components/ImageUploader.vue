<template>
  <v-dialog v-model="dialog" max-width="600">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn v-bind="activatorProps" class="ml-3" color="grey-lighten-1">
        <v-icon icon="mdi-image-plus-outline" size="large"></v-icon>
      </v-btn>
    </template>

    <template v-slot:default="{ isActive }">
      <v-card>
        <v-toolbar color="primary" title="Image Selector"> </v-toolbar>
        <div class="d-flex flex-row inner-card-height">
          <v-tabs v-model="tab" color="orange" direction="vertical" @update:modelValue="tabChange">
            <v-tab prepend-icon="mdi-desktop-classic" text="Desktop" value="pc"></v-tab>
            <v-tab prepend-icon="mdi-camera-outline" text="Camera" value="cam"></v-tab>
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
                  <v-container>
                    <v-row class="align-center">
                      <v-col cols="auto">
                        <div class="preview">
                          <img v-if="imagePreviewUrl" :src="imagePreviewUrl" alt="Image Preview" />
                          <v-icon
                            v-else
                            icon="mdi-image-outline"
                            size="50"
                            color="grey-darken-2"
                            @click="triggerFileInput"
                          />
                        </div>
                      </v-col>
                      <v-col>
                        <v-file-input
                          label="Click here to select a file"
                          accept="image/*"
                          prepend-icon=""
                          hide-details
                          @change="handleFileChange"
                          @click:clear="clearInputs"
                        />
                      </v-col>
                    </v-row>
                  </v-container>
                </v-tabs-window-item>

                <v-tabs-window-item value="recent" class="recent-files">
                  <v-container>
                    <v-row justify="center">
                      <div v-if="recents.length">
                        <v-card v-for="file in recents" :key="file.url" width="100" height="100">
                          <img :src="file.url" alt="file.name" />
                        </v-card>
                      </div>
                      <h3 v-else>There are no recent files available to view</h3>
                    </v-row>
                  </v-container>
                </v-tabs-window-item>
              </v-tabs-window>
            </div>
          </v-card-text>
        </div>
        <template v-slot:actions>
          <v-btn
            v-if="tab === 'pc'"
            class="ml-auto"
            text="Upload"
            prepend-icon="mdi-upload"
            :disabled="selectedFile === null"
            @click="uploadImage"
          />
          <v-btn text="Close" @click="closeDialog(isActive)" />
        </template>
      </v-card>
    </template>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import api from '@/plugins/axios';

const recents = ref<RecentFiles[]>([]);
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
      closeDialog();
    });
}

function tabChange() {
  if (tab.value === 'recent') getRecentFiles();
}

function getRecentFiles() {
  api.get('/recent').then(({ data }) => {
    recents.value = data;
  });
}

function closeDialog(isActive) {
  if (isActive) isActive.value = false;
  dialog.value = false;
  clearInputs();
  tab.value = 'pc';
}
</script>

<style scoped>
.inner-card-height {
  height: 300px;
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
  display: flex;
  flex-grow: 0;
  justify-content: center;
  align-items: center;
}
.preview img {
  width: 100%;
  height: 100%;
}
.recent-files img {
  width: 100%;
  height: 100%;
}
</style>
