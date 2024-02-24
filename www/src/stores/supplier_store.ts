import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useSupplierStore = defineStore('suppliers', () => {
  const suppliers = ref<SupplierDoc[]>([]);

  const sorted = computed(() => {
    return [...suppliers.value].sort((a, b) => {
      const c = a.name.toLowerCase();
      const d = b.name.toLowerCase();
      if (c < d) return -1;
      else if (d < c) return 1;
      else return 0;
    });
  });

  function fetch() {
    axios.get('/suppliers').then(({ data }) => {
      suppliers.value = data;
    });
  }

  async function add(supplier: Supplier) {
    await axios.post('/suppliers', { data: supplier }).then(({ data }) => {
      suppliers.value.push(data);
    });
  }

  async function update(doc: SupplierDoc) {
    await axios.put('/suppliers', { data: doc }).then(() => {
      const i = suppliers.value.findIndex((x) => x._id === doc._id);
      suppliers.value[i] = doc;
    });
  }

  return {
    suppliers,
    sorted,
    fetch,
    add,
    update,
  };
});
