import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useVendorStore } from '@/stores/vendor_store';

export const useToolStore = defineStore('tools', () => {
  const vendorStore = useVendorStore();

  const rawTools = ref<ToolDoc[]>([]);

  const tools = computed(() => {
    return rawTools.value.map((x) => {
      return {
        ...x,
        _vendor: vendorStore.vendors.find((y) => y._id === x._vendor),
      };
    });
  });

  const millingTools = computed(() => {
    return tools.value.filter((x) => x.type === 'milling');
  });

  const turningTools = computed(() => {
    return tools.value.filter((x) => x.type === 'turning');
  });

  const loading = ref(false);
  function fetch() {
    loading.value = true;
    axios
      .get('/tools')
      .then(({ data }) => {
        rawTools.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  async function add(vendor: Tool) {
    const data = {
      ...vendor,
      type: vendor.type.toLowerCase(),
    };
    await axios.post('/tools', { data }).then(({ data }) => {
      rawTools.value.push(data);
    });
  }

  async function update(doc: ToolDoc) {
    await axios.put('/tools', { data: doc }).then(() => {
      const i = rawTools.value.findIndex((x) => x._id === doc._id);
      rawTools.value[i] = doc;
    });
  }

  return {
    rawTools,
    tools,
    loading,
    fetch,
    add,
    update,
    millingTools,
    turningTools,
  };
});
