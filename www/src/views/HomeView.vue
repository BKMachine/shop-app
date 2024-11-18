<template>
  <ImageUploader id="10" type="part" />
  <div>
    <img :src="logo" alt="logo" />
  </div>
</template>

<script setup lang="ts">
import logo from '@/assets/img/bk_logo.png';
import ImageUploader from '@/components/ImageUploader.vue';
</script>

<style scoped>
div {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
img {
  opacity: 0.7;
}
</style>
