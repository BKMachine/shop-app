import uniq from 'lodash/uniq';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import axios from '@/plugins/axios';
import { useSupplierStore } from '@/stores/supplier_store';
import { useVendorStore } from '@/stores/vendor_store';

export const useToolStore = defineStore('tools', () => {
  const vendorStore = useVendorStore();
  const supplierStore = useSupplierStore();

  const rawTools = ref<Tool[]>([]);

  const tools = computed<Tool[]>(() => {
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

  const swissTools = computed(() => {
    return tools.value.filter((x) => x.category === 'swiss');
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
      .then(({ data }: { data: Tool[] }) => {
        rawTools.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  const totalStockCost = computed(() => {
    const milling = [...rawTools.value].filter((x) => x.category === 'milling');
    const turning = [...rawTools.value].filter((x) => x.category === 'turning');
    const other = [...rawTools.value].filter((x) => x.category === 'other');
    return {
      milling: reduce(milling),
      turning: reduce(turning),
      other: reduce(other),
      total: reduce([...rawTools.value]),
    };
    function reduce(tools: Tool[]) {
      const cost = tools.reduce((a, b) => {
        return a + (b.stock * b.cost || 0);
      }, 0);
      return parseFloat(cost.toFixed(2));
    }
  });

  watch(totalStockCost, () => {
    console.log(totalStockCost.value);
  });

  const tabChange = ref(false);

  function setTabChange(bool: boolean) {
    tabChange.value = bool;
  }

  const lastId = ref<string | null>(null);

  function setLastId(id: string | null) {
    lastId.value = id;
  }

  async function add(tool: Tool) {
    const data = {
      ...tool,
      category: tool.category.toLowerCase(),
    };
    await axios.post('/tools', { data }).then(({ data }: { data: Tool }) => {
      rawTools.value.push(data);
    });
  }

  async function update(tool: Tool) {
    await axios.put('/tools', { data: tool }).then(({ data }: { data: Tool }) => {
      const index = rawTools.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  async function pickTool(scanCode: string) {
    await axios.put('/tools/pick', { scanCode }).then(({ data }: { data: Tool }) => {
      const index = rawTools.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  async function adjustStock(id: string, amount: number) {
    await axios.put('/tools/stock', { id, amount }).then(({ data }: { data: Tool }) => {
      const index = rawTools.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawTools.value[index] = data;
    });
  }

  const trigger = ref({ toolID: '' });

  function SOCKET_tool(tool: Tool) {
    const index = rawTools.value.findIndex((x) => x._id === tool._id);
    if (index > -1) {
      rawTools.value[index] = tool;
      trigger.value.toolID = tool._id;
      setTimeout(() => (trigger.value.toolID = ''), 500);
    }
  }

  return {
    rawTools,
    tools,
    loading,
    millingTools,
    turningTools,
    swissTools,
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
