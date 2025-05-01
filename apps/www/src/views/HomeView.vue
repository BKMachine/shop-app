<template>
  <div>
    <img :src="logo" alt="logo" />
  </div>
</template>

<script setup lang="ts">
import logo from '@/assets/img/bk_logo.png';
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
