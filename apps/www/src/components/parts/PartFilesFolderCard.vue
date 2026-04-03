<template>
  <div class="folder-helper-field">
    <v-text-field
      v-model="props.part.partFilesPath"
      :color="showInstallHint ? 'error' : undefined"
      hide-details="auto"
      :hint="helperHint"
      label="Files Path"
      persistent-hint
      placeholder="M:\Customer\Part"
      variant="outlined"
    >
      <template #append-inner>
        <v-chip :color="helperStatusColor" size="small" variant="tonal">
          {{ helperStatusChip }}
        </v-chip>
      </template>
    </v-text-field>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useFolderHelperState } from '@/state/folderHelper';

const props = defineProps<{
  part: Part;
}>();

const { helperStatus, helperStatusColor, loadFolderHelperManifest } = useFolderHelperState();

const showInstallHint = computed(() => helperStatus.value === 'needs-install');
const helperHint = computed(() => {
  if (showInstallHint.value) {
    return 'Folder Helper not detected on this PC. Install it to use the Files button.';
  }

  return 'Accepts UNC paths and mapped drive paths.';
});

const helperStatusChip = computed(() => {
  if (helperStatus.value === 'likely-installed') return 'Ready';
  if (helperStatus.value === 'needs-install') return 'Missing';
  if (helperStatus.value === 'not-windows') return 'Windows';
  return 'Unknown';
});

onMounted(() => {
  void loadFolderHelperManifest();
});
</script>

<style scoped>
.folder-helper-field {
  width: 100%;
}
</style>
