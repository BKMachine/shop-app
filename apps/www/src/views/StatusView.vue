<template>
  <div class="container">
    <div v-for="machine in machines" :key="machine.id" class="machine">
      <MachineTile :data="machine" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MachineTile from '@/components/MachineTile.vue';
import axios from 'axios';
import { onMounted, ref } from 'vue';

const machines = ref<MachineInfo[]>([]);

onMounted(() => {
  axios
    .get<MachineInfo[]>('http://localhost:3001/api/machines')
    .then(({ data }) => {
      machines.value = data;
    })
    .catch((error) => {
      console.error('Error fetching status:', error);
    });
});
</script>

<style scoped>
.container {
  display: flex;
  flex-wrap: wrap;
}
.machine {
  margin: 3px;
}
</style>
