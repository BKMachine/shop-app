import uniq from 'lodash/uniq';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import axios from '@/plugins/axios';
import { useSupplierStore } from '@/stores/supplier_store';
import { useVendorStore } from '@/stores/vendor_store';

export const useToolStore = defineStore('tools', () => {
  const vendorStore = useVendorStore();
  const supplierStore = useSupplierStore();

  const rawTools = ref<ToolDoc[]>([]);

  const tools = computed<ToolDoc[]>(() => {
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
    return uniq(
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

  const totalStockCost = computed(() => {
    return [...rawTools.value].reduce((a, b) => {
      return a + (b.stock * b.cost || 0);
    }, 0);
  });

  watch(totalStockCost, () => {
    console.log(parseFloat(totalStockCost.value.toFixed(2)));
  });

  const tabChange = ref(false);

  function setTabChange(bool: boolean) {
    tabChange.value = bool;
  }

  const lastId = ref<string | null>(null);

  function setLastId(id: string | null) {
    lastId.value = id;
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

  async function update(tool: ToolDoc) {
    await axios.put('/tools', { data: tool }).then(({ data }: { data: ToolDoc }) => {
      const index = rawTools.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  async function pickTool(scanCode: string) {
    await axios.put('/tools/pick', { scanCode }).then(({ data }: { data: ToolDoc }) => {
      const index = rawTools.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  async function adjustStock(id: string, amount: number) {
    await axios.put('/tools/stock', { id, amount }).then(({ data }: { data: ToolDoc }) => {
      const index = rawTools.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  const trigger = ref({ tool: 0 });

  function SOCKET_tool(tool: ToolDoc) {
    const index = rawTools.value.findIndex((x) => x._id === tool._id);
    if (index > -1) {
      rawTools.value[index] = tool;
      trigger.value.tool++;
    }
  }

  return {
    rawTools,
    tools,
    loading,
    millingTools,
    turningTools,
    otherTools,
    locations,
    tabChange,
    lastId,
    trigger,
    fetch,
    add,
    update,
    pickTool,
    adjustStock,
    SOCKET_tool,
    setTabChange,
    setLastId,
  };
});
