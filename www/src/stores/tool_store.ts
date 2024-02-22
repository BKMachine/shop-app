import { defineStore } from 'pinia';
import axios from '@/plugins/axios';
import { ref, computed } from 'vue';

export const useToolStore = defineStore('tools', () => {
  const manufacturers = ref<ToolManufacturer[]>([]);

  const manufacturersSorted = computed(() => {
    return manufacturers.value.sort((a, b) => {
      const c = a.name.toLowerCase();
      const d = b.name.toLowerCase();
      if (c < d) return -1;
      else if (d < c) return 1;
      else return 0;
    });
  });

  function getManufacturers() {
    axios.get('/tools/manufacturers').then(({ data }) => {
      manufacturers.value = data;
    });
  }

  return { manufacturers, manufacturersSorted, getManufacturers };
});
