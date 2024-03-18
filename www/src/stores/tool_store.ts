import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useSupplierStore } from '@/stores/supplier_store';
import { useVendorStore } from '@/stores/vendor_store';

export const useToolStore = defineStore('tools', () => {
  const vendorStore = useVendorStore();
  const supplierStore = useSupplierStore();

  const rawTools = ref<ToolDoc[]>([]);

  const tools = computed<ToolDoc_Pop[]>(() => {
    return rawTools.value.map((x) => {
      return {
        ...x,
        vendor: vendorStore.vendors.find((y) => y._id === x.vendor),
        supplier: supplierStore.suppliers.find((y) => y._id === x.supplier),
      };
    });
  });

  const millingTools = computed(() => {
    return tools.value.filter((x) => x.category === 'milling');
  });

  const turningTools = computed(() => {
    return tools.value.filter((x) => x.category === 'turning');
  });

  const otherTools = computed(() => {
    return tools.value.filter((x) => x.category === 'other');
  });

  const locations = computed(() => {
    return new Set(
      tools.value
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
      .get('/tools')
      .then(({ data }: { data: ToolDoc[] }) => {
        rawTools.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  async function add(tool: ToolDoc) {
    const data = {
      ...tool,
      category: tool.category.toLowerCase(),
    };
    await axios.post('/tools', { data }).then(({ data }: { data: ToolDoc }) => {
      rawTools.value.push(data);
    });
  }

  async function update(tool: ToolDoc_Pop) {
    await axios.put('/tools', { data: tool }).then(({ data }: { data: ToolDoc }) => {
      const index = rawTools.value.findIndex((x) => x._id === tool._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  async function adjustStock(id: string, num: number) {
    const index = tools.value.findIndex((x) => x._id === id);
    const tool = tools.value[index];
    if (!tool) return;
    const clone: ToolDoc_Pop = {
      ...tool,
      stock: (tool.stock += num),
    };
    if (clone.stock < 0) throw Error('Stock cannot be less than 0');
    await update(clone);
  }

  function SOCKET_tool(tool: ToolDoc) {
    const index = rawTools.value.findIndex((x) => x._id === tool._id);
    if (index > -1) rawTools.value[index] = tool;
  }

  return {
    rawTools,
    tools,
    loading,
    millingTools,
    turningTools,
    otherTools,
    locations,
    fetch,
    add,
    update,
    adjustStock,
    SOCKET_tool,
  };
});
