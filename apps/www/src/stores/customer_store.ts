import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';

export const useCustomerStore = defineStore('customers', () => {
  const _customers = ref<Customer[]>([]);

  const customers = computed(() => {
    return [..._customers.value].sort((a, b) => {
      const c = a.name.toLowerCase();
      const d = b.name.toLowerCase();
      if (c < d) return -1;
      else if (d < c) return 1;
      else return 0;
    });
  });

  function fetch() {
    axios.get<Customer[]>('/customers').then(({ data }) => {
      _customers.value = data;
    });
  }

  async function add(customer: Customer) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = customer;
    await axios.post<Customer>('/customers', { data: rest }).then(({ data }) => {
      _customers.value.push(data);
    });
  }

  async function update(customer: Customer) {
    await axios.put<Customer>('/customers', { data: customer }).then(() => {
      const index = _customers.value.findIndex((x) => x._id === customer._id);
      if (index > -1) _customers.value[index] = customer;
    });
  }

  return {
    _customers,
    customers,
    fetch,
    add,
    update,
  };
});
