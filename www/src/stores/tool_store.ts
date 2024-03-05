import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useVendorStore } from '@/stores/vendor_store';

export const useToolStore = defineStore('tools', () => {
  const vendorStore = useVendorStore();

  const rawTools = ref<ToolDoc[]>([]);

  const tools = computed<ToolDocPopulated[]>(() => {
    return rawTools.value.map((x) => {
      return {
        ...x,
        vendor: vendorStore.vendors.find((y) => y._id === x.vendor) as VendorDoc,
      };
    });
  });

  const millingTools = computed(() => {
    return tools.value.filter((x) => x.category === 'milling');
  });

  const turningTools = computed(() => {
    return tools.value.filter((x) => x.category === 'turning');
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

  async function add(tool: ToolDocPopulated) {
    const data = {
      ...tool,
      category: tool.category.toLowerCase(),
    };
    await axios.post('/tools', { data }).then(({ data }) => {
      rawTools.value.push(data);
    });
  }

  async function update(doc: ToolDocPopulated) {
    const vendor = doc.vendor;
    if (vendor && typeof vendor === 'object') {
      doc.vendor = vendor._id;
    }
    await axios.put('/tools', { data: doc }).then(({ data }: { data: ToolDoc }) => {
      const i = rawTools.value.findIndex((x) => x._id === doc._id);
      rawTools.value[i] = data;
    });
  }

  async function adjustStock(id: string, num: number) {
    const i = rawTools.value.findIndex((x) => x._id === id);
    const tool = rawTools.value[i];
    if (!tool) return;
    const clone: ToolDocPopulated = {
      ...tool[i],
      vendor: tool.vendor as VendorDoc,
    };
    clone.stock += num;
    if (clone.stock < 0) throw Error('Stock cannot be less than 0');
    await update(clone);
  }
  return {
    rawTools,
    tools,
    loading,
    millingTools,
    turningTools,
    fetch,
    add,
    update,
    adjustStock,
  };
});
