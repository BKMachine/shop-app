<template>
  <v-card>
    <v-card-title class="title-404">
      <v-icon class="mr-2" color="red">mdi-alert</v-icon>
      Not Found
    </v-card-title>
    <v-card-text>
      No items were found with the scan code:
      <span class="scan-code">
        {{ scanCode }}
        <v-icon size="14" class="copy-icon" @click="copyToClipboard">mdi-content-copy</v-icon>
      </span>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn color="primary" variant="elevated" @click="close">OK</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
const props = defineProps<{
  scanCode: string;
}>();
const emit = defineEmits(['close']);

function copyToClipboard() {
  navigator.clipboard.writeText(props.scanCode);
}

function close() {
  emit('close');
}
</script>

<style scoped>
.title-404 {
  display: flex;
  align-items: center;
}
.scan-code {
  font-weight: bolder;
}
.copy-icon {
  position: relative;
  bottom: 10px;
  right: 3px;
}
</style>
