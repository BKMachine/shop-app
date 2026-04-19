import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

export const useCustomerStore = defineStore('customers', () => {
  const _customers = ref<Customer[]>([]);

  const customers = computed(() => {
    return [..._customers.value].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });

  function fetch() {
    api.get<Customer[]>('/customers').then(({ data }) => {
      _customers.value = data;
    });
  }

  async function add(customer: Customer) {
    await api
      .post<Customer>('/customers', { customer })
      .then(({ data }) => {
        _customers.value.push(data);
        toastSuccess('Customer added successfully');
      })
      .catch(() => {
        toastError('Failed to add customer');
      });
  }

  async function update(customer: Customer) {
    await api
      .put<Customer>('/customers', { customer })
      .then(() => {
        const index = _customers.value.findIndex((x) => x._id === customer._id);
        if (index > -1) _customers.value[index] = customer;
        toastSuccess('Customer updated successfully');
      })
      .catch(() => {
        toastError('Failed to update customer');
      });
  }

  function updateCustomerLogo(customerId: string, logo: string) {
    const index = _customers.value.findIndex((customer) => customer._id === customerId);
    const customer = _customers.value[index];
    if (customer) customer.logo = logo;
  }

  return {
    customers,
    fetch,
    add,
    update,
    updateCustomerLogo,
  };
});
