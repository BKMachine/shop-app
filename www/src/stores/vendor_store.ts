import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useVendorStore = defineStore('vendors', () => {
  const vendors = ref<VendorDoc[]>([]);

  const sorted = computed(() => {
    return [...vendors.value].sort((a, b) => {
      const c = a.name.toLowerCase();
      const d = b.name.toLowerCase();
      if (c < d) return -1;
      else if (d < c) return 1;
      else return 0;
    });
  });

  function fetch() {
    axios.get('/vendors').then(({ data }) => {
      vendors.value = data;
    });
  }

  async function add(vendor: Vendor) {
    await axios.post('/vendors', { data: vendor }).then(({ data }) => {
      vendors.value.push(data);
    });
  }

  async function update(doc: VendorDoc) {
    await axios.put('/vendors', { data: doc }).then(() => {
      const i = vendors.value.findIndex((x) => x._id === doc._id);
      vendors.value[i] = doc;
    });
  }

  return {
    vendors,
    sorted,
    fetch,
    add,
    update,
  };
});
