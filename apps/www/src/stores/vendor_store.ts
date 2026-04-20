import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

export const useVendorStore = defineStore('vendors', () => {
  const _vendors = ref<Vendor[]>([]);

  const vendors = computed(() => {
    return [..._vendors.value].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });

  function fetch() {
    api.get<Vendor[]>('/vendors').then(({ data }) => {
      _vendors.value = data;
    });
  }

  async function add(vendor: VendorCreate) {
    await api
      .post<Vendor>('/vendors', { vendor })
      .then(({ data }) => {
        _vendors.value.push(data);
        toastSuccess('Vendor added successfully!');
      })
      .catch(() => {
        toastError('Failed to add vendor. Please try again.');
      });
  }

  async function update(vendor: VendorUpdate) {
    if (vendor.coatings) {
      vendor.coatings = vendor.coatings.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      );
    }
    await api
      .put<Vendor>('/vendors', { vendor })
      .then(() => {
        const index = _vendors.value.findIndex((x) => x._id === vendor._id);
        if (index > -1) _vendors.value[index] = vendor;
        toastSuccess('Vendor updated successfully!');
      })
      .catch(() => {
        toastError('Failed to update vendor. Please try again.');
      });
  }

  function updateVendorLogo(vendorId: string, logo: string) {
    const index = _vendors.value.findIndex((vendor) => vendor._id === vendorId);
    const vendor = _vendors.value[index];
    if (vendor) vendor.logo = logo;
  }

  async function removeVendorLogo(vendorId: string) {
    return api
      .delete(`/images/entities/vendor/${vendorId}/image`)
      .then(() => {
        updateVendorLogo(vendorId, '');
        toastSuccess('Vendor logo removed successfully');
        return true;
      })
      .catch(() => {
        toastError('Failed to remove vendor logo');
        return false;
      });
  }

  return {
    vendors,
    fetch,
    add,
    update,
    removeVendorLogo,
    updateVendorLogo,
  };
});
