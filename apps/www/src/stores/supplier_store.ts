import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

export const useSupplierStore = defineStore('suppliers', () => {
  const _suppliers = ref<Supplier[]>([]);

  const suppliers = computed(() => {
    return [..._suppliers.value].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });

  function fetch() {
    api.get<Supplier[]>('/suppliers').then(({ data }) => {
      _suppliers.value = data;
    });
  }

  async function add(supplier: Omit<Supplier, '_id'>) {
    await api
      .post<Supplier>('/suppliers', { supplier })
      .then(({ data }) => {
        _suppliers.value.push(data);
        toastSuccess('Supplier added successfully');
      })
      .catch(() => {
        toastError('Failed to add supplier. Please try again.');
      });
  }

  async function update(supplier: Supplier) {
    await api
      .put<Supplier>('/suppliers', { supplier })
      .then(() => {
        const index = _suppliers.value.findIndex((x) => x._id === supplier._id);
        if (index > -1) _suppliers.value[index] = supplier;
        toastSuccess('Supplier updated successfully');
      })
      .catch(() => {
        toastError('Failed to update supplier. Please try again.');
      });
  }

  function updateSupplierLogo(supplierId: string, logo: string) {
    const index = _suppliers.value.findIndex((supplier) => supplier._id === supplierId);
    const supplier = _suppliers.value[index];
    if (supplier) supplier.logo = logo;
  }

  return {
    _suppliers,
    suppliers,
    fetch,
    add,
    update,
    updateSupplierLogo,
  };
});
