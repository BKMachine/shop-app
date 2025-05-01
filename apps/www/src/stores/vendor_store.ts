import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useVendorStore = defineStore('vendors', () => {
  const _vendors = ref<VendorDoc[]>([]);

  const vendors = computed(() => {
    return [..._vendors.value].sort((a, b) => {
      const c = a.name.toLowerCase();
      const d = b.name.toLowerCase();
      if (c < d) return -1;
      else if (d < c) return 1;
      else return 0;
    });
  });

  function fetch() {
    axios.get('/vendors').then(({ data }) => {
      _vendors.value = data;
    });
  }

  async function add(vendor: VendorDoc) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = vendor;
    await axios.post('/vendors', { data: rest }).then(({ data }) => {
      _vendors.value.push(data);
    });
  }

  async function update(vendor: VendorDoc) {
    if (vendor.coatings)
      vendor.coatings = vendor.coatings.sort((a, b) => {
        const c = a.toLowerCase();
        const d = b.toLowerCase();
        if (c < d) return -1;
        else if (c > d) return 1;
        else return 0;
      });
    await axios.put('/vendors', { data: vendor }).then(() => {
      const i = _vendors.value.findIndex((x) => x._id === vendor._id);
      _vendors.value[i] = vendor;
    });
  }

  return {
    _vendors,
    vendors,
    fetch,
    add,
    update,
  };
});
