import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useToolStore = defineStore('tools', () => {
  const manufacturers = ref<ToolManufacturerDoc[]>([]);

  const manufacturersSorted = computed(() => {
    return [...manufacturers.value].sort((a, b) => {
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

  function addManufacturer(doc: ToolManufacturerDoc) {
    manufacturers.value.push(doc);
  }

  function updateManufacturer(doc: ToolManufacturerDoc) {
    const i = manufacturers.value.findIndex((x) => x._id === doc._id);
    manufacturers.value[i] = doc;
  }

  return {
    manufacturers,
    manufacturersSorted,
    getManufacturers,
    addManufacturer,
    updateManufacturer,
  };
});
