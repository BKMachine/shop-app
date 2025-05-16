import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useVendorStore = defineStore('vendors', () => {
  const _vendors = ref<Vendor[]>([]);

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
    axios.get<Vendor[]>('/vendors').then(({ data }) => {
      _vendors.value = data;
    });
  }

  async function add(vendor: Vendor) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = vendor;
    await axios.post<Vendor>('/vendors', { data: rest }).then(({ data }) => {
      _vendors.value.push(data);
    });
  }

  async function update(vendor: Vendor) {
    if (vendor.coatings)
      vendor.coatings = vendor.coatings.sort((a, b) => {
        const c = a.toLowerCase();
        const d = b.toLowerCase();
        if (c < d) return -1;
        else if (c > d) return 1;
        else return 0;
      });
    await axios.put<Vendor>('/vendors', { data: vendor }).then(() => {
      const index = _vendors.value.findIndex((x) => x._id === vendor._id);
      if (index > -1) _vendors.value[index] = vendor;
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
