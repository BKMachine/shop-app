import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from '@/plugins/axios';
import { socket } from '@/plugins/socket';

const UNKNOWN_SUPPLIER_ID = '69e831ef362f135a3e00c527';

export const useToolStore = defineStore('tools', () => {
  const tools = ref<Tool[]>([]);
  const total = ref(0);
  const limit = ref(20);
  const offset = ref(0);
  const hasMore = ref(false);
  const currentQuery = ref<ToolListFilters>({});
  const loading = ref(false);
  const loadingMore = ref(false);
  const activeRequestId = ref(0);

  // Remove empty or undefined query parameters
  function normalizeQuery(query: ToolListFilters): ToolListFilters {
    return Object.fromEntries(
      Object.entries(query).filter(
        ([, value]) => value !== '' && value !== undefined && value !== null,
      ),
    ) as ToolListFilters;
  }

  async function fetch(query: ToolListFilters = {}, append = false) {
    const requestId = ++activeRequestId.value;
    const nextQuery = normalizeQuery(query);
    const nextLimit = Math.min(Math.max(Number(nextQuery.limit) || limit.value || 10, 1), 100);
    const nextOffset = append ? tools.value.length : Math.max(Number(nextQuery.offset) || 0, 0);

    const requestQuery: ToolListFilters = {
      ...nextQuery,
      limit: nextLimit,
      offset: nextOffset,
    };

    currentQuery.value = {
      ...nextQuery,
      limit: nextLimit,
    };

    if (append) loadingMore.value = true;
    else loading.value = true;

    try {
      const { data } = await axios.get<ToolListResponse>('/tools', {
        params: requestQuery,
      });

      if (requestId !== activeRequestId.value) {
        return;
      }

      if (append) {
        const existingIds = new Set(tools.value.map((tool) => tool._id));
        tools.value = [...tools.value, ...data.items.filter((tool) => !existingIds.has(tool._id))];
      } else {
        tools.value = data.items;
      }

      total.value = data.total;
      limit.value = data.limit;
      offset.value = requestQuery.offset || 0;
      hasMore.value = data.hasMore;
    } finally {
      if (requestId === activeRequestId.value) {
        if (append) loadingMore.value = false;
        else loading.value = false;
      }
    }
  }

  function reset() {
    activeRequestId.value++;
    tools.value = [];
    total.value = 0;
    offset.value = 0;
    hasMore.value = false;
    currentQuery.value = {};
    loading.value = false;
    loadingMore.value = false;
  }

  async function fetchNextPage() {
    if (loading.value || loadingMore.value || !hasMore.value) return;
    await fetch(currentQuery.value, true);
  }

  // Last id is used to highlight the last tool selected to provide
  // feedback when the user goes back to the list after viewing or editing a tool
  const lastId = ref<string | null>(null);

  function setLastId(id: string | null) {
    lastId.value = id;
  }

  function toEntityId(value?: string | { _id: string } | null) {
    if (!value) return undefined;
    return typeof value === 'string' ? value : value._id;
  }

  async function add(tool: Tool) {
    const payload: ToolCreate = {
      ...tool,
      vendor: toEntityId(tool.vendor),
      supplier: toEntityId(tool.supplier) ?? UNKNOWN_SUPPLIER_ID,
    };

    await axios.post<Tool>('/tools', { tool: payload }).then(({ data }) => {
      upsertTool(data);
    });
  }

  async function update(tool: Tool) {
    const payload: ToolUpdate = {
      ...tool,
      vendor: toEntityId(tool.vendor),
      supplier: toEntityId(tool.supplier) ?? UNKNOWN_SUPPLIER_ID,
    };

    await axios.put<Tool>('/tools', { tool: payload }).then(({ data }) => {
      upsertTool(data);
    });
  }

  function updateToolImage(toolId: string, img: string) {
    const index = tools.value.findIndex((tool) => tool._id === toolId);
    const tool = tools.value[index];
    if (tool) tool.img = img;
  }

  async function pickTool(scanCode: string) {
    await axios.put<Tool>('/tools/pick', { scanCode }).then(({ data }) => {
      upsertTool(data);
    });
  }

  async function adjustStock(id: string, amount: number) {
    await axios.put<Tool>('/tools/stock', { id, amount }).then(({ data }) => {
      upsertTool(data);
    });
  }

  const toolUpdateSignal = ref({ id: '' });

  function triggerToolUpdateSignal(toolId: string) {
    toolUpdateSignal.value.id = toolId;
    setTimeout(() => {
      toolUpdateSignal.value.id = '';
    }, 500);
  }

  function upsertTool(tool: Tool) {
    const index = tools.value.findIndex((candidate) => candidate._id === tool._id);
    if (index > -1) tools.value[index] = tool;
    else tools.value.push(tool);

    triggerToolUpdateSignal(tool._id);
  }

  socket.on('tool', (tool: Tool) => {
    upsertTool(tool);
  });

  socket.on('vendor', (vendor: Vendor) => {
    tools.value
      .filter((tool) => tool.vendor?._id === vendor._id)
      .forEach((tool) => {
        tool.vendor = vendor;
      });
  });

  socket.on('supplier', (supplier: Supplier) => {
    tools.value
      .filter((tool) => tool.supplier?._id === supplier._id)
      .forEach((tool) => {
        tool.supplier = supplier;
      });
  });

  return {
    tools,
    loading,
    loadingMore,
    total,
    limit,
    offset,
    hasMore,
    currentQuery,
    lastId,
    toolUpdateSignal,
    fetch,
    fetchNextPage,
    reset,
    add,
    update,
    updateToolImage,
    pickTool,
    adjustStock,
    setLastId,
  };
});
