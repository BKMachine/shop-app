import uniq from 'lodash/uniq';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useCustomerStore } from '@/stores/customer_store';

export const usePartStore = defineStore('parts', () => {
  const customerStore = useCustomerStore();

  const rawParts = ref<Part[]>([]);

  const parts = computed<Part[]>(() => {
    return rawParts.value.map((x) => {
      return {
        ...x,
        customer: customerStore.customers.find((y) => y._id === x.customer) || x.customer,
      };
    });
  });

  const locations = computed(() => {
    return uniq(
      parts.value
        .filter((x) => x.location)
        .map((x) => x.location)
        .sort((a, b) => {
          const c = (a as string).toLowerCase();
          const d = (b as string).toLowerCase();
          if (c < d) return -1;
          else if (c > d) return 1;
          else return 0;
        }),
    );
  });

  const loading = ref(false);
  function fetch() {
    loading.value = true;
    axios
      .get<Part[]>('/parts')
      .then(({ data }) => {
        rawParts.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  const lastId = ref<string | null>(null);
  function setLastId(id: string | null) {
    lastId.value = id;
  }

  async function add(part: Part) {
    await axios.post<Part>('/parts', { data: part }).then(({ data }) => {
      rawParts.value.push(data);
    });
  }

  async function update(part: Part) {
    await axios.put<Part>('/parts', { data: part }).then(({ data }) => {
      const index = rawParts.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawParts.value[index] = data;
    });
  }

  return {
    rawParts,
    parts,
    locations,
    loading,
    lastId,
    fetch,
    setLastId,
    add,
    update,
  };
});
