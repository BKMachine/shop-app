<template>
  <div v-for="item in items" :key="item._id">
    {{ item.item }}
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import axios from '@/plugins/axios';

const items = ref<ToolDoc[]>([]);

onMounted(() => {
  items.value = [];
  axios.get('/tools/reorders').then(({ data }) => {
    items.value = data;
  });
});
</script>

<style scoped></style>
