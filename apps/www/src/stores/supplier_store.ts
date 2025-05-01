import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useSupplierStore = defineStore('suppliers', () => {
  const _suppliers = ref<SupplierDoc[]>([]);

  const suppliers = computed(() => {
    return [..._suppliers.value].sort((a, b) => {
      const c = a.name.toLowerCase();
      const d = b.name.toLowerCase();
      if (c < d) return -1;
      else if (d < c) return 1;
      else return 0;
    });
  });

  function fetch() {
    axios.get('/suppliers').then(({ data }) => {
      _suppliers.value = data;
    });
  }

  async function add(supplier: SupplierDoc) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = supplier;
    await axios.post('/suppliers', { data: rest }).then(({ data }) => {
      _suppliers.value.push(data);
    });
  }

  async function update(supplier: SupplierDoc) {
    await axios.put('/suppliers', { data: supplier }).then(() => {
      const i = _suppliers.value.findIndex((x) => x._id === supplier._id);
      _suppliers.value[i] = supplier;
    });
  }

  return {
    _suppliers,
    suppliers,
    fetch,
    add,
    update,
  };
});
