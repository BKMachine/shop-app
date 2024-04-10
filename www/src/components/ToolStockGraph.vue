<template>
  <div class="container">
    <div v-for="item in filteredItems" :key="item._id">
      {{ item.old.stock }} - {{ item.new.stock }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime, Duration } from 'luxon';
import { computed, onMounted, ref } from 'vue';
import axios from '@/plugins/axios';

const props = defineProps<{
  id: string;
}>();

const items = ref<AuditDoc[]>([] as AuditDoc[]);
const from = ref<DateTime>();
const to = ref<DateTime>();

onMounted(() => {
  to.value = DateTime.now();
  const diff = Duration.fromObject({ month: 1 });
  from.value = DateTime.now().minus(diff);
  axios
    .post('/audits/tools/stock', {
      id: props.id,
      from: from.value.toISO(),
      to: to.value.toISO(),
    })
    .then(({ data }: { data: AuditDoc[] }) => {
      items.value = data;
    });
});

const filteredItems = computed(() => {
  return [...items.value].filter((x) => x.old.stock !== x.new.stock);
});
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
}
</style>
