import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from '@/plugins/axios';

export const useToolStore = defineStore('tools', () => {
  const tools = ref<Tool[]>([]);
  const total = ref(0);
  const limit = ref(20);
  const offset = ref(0);
  const hasMore = ref(false);
  const currentQuery = ref<ToolListFilters>({});
  const loading = ref(false);
  const loadingMore = ref(false);

  // Remove empty or undefined query parameters
  function normalizeQuery(query: ToolListFilters): ToolListFilters {
    return Object.fromEntries(
      Object.entries(query).filter(
        ([, value]) => value !== '' && value !== undefined && value !== null,
      ),
    ) as ToolListFilters;
  }

  async function fetch(query: ToolListFilters = {}, append = false) {
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
      if (append) loadingMore.value = false;
      else loading.value = false;
    }
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

  async function add(tool: Tool) {
    const data = {
      ...tool,
      category: tool.category.toLowerCase(),
    };

    await axios.post<Tool>('/tools', { data }).then(({ data }) => {
      handleToolMutation(data);
    });
  }

  async function update(tool: Tool) {
    await axios.put<Tool>('/tools', { data: tool }).then(({ data }) => {
      handleToolMutation(data);
    });
  }

  function updateToolImage(toolId: string, img: string) {
    const index = tools.value.findIndex((tool) => tool._id === toolId);
    const tool = tools.value[index];
    if (tool) tool.img = img;
  }

  async function pickTool(scanCode: string) {
    await axios.put<Tool>('/tools/pick', { scanCode }).then(({ data }) => {
      handleToolMutation(data);
    });
  }

  async function adjustStock(id: string, amount: number) {
    await axios.put<Tool>('/tools/stock', { id, amount }).then(({ data }) => {
      handleToolMutation(data);
    });
  }

  function replaceToolData(tool: Tool) {
    const index = tools.value.findIndex((candidate) => candidate._id === tool._id);
    if (index > -1) tools.value[index] = tool;
  }

  const toolUpdateSignal = ref({ id: '' });

  function triggerToolUpdateSignal(toolId: string) {
    toolUpdateSignal.value.id = toolId;
    setTimeout(() => {
      toolUpdateSignal.value.id = '';
    }, 500);
  }

  function handleToolMutation(tool: Tool) {
    replaceToolData(tool);
    triggerToolUpdateSignal(tool._id);
  }

  function SOCKET_tool(tool: Tool) {
    replaceToolData(tool);
    triggerToolUpdateSignal(tool._id);
  }

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
    add,
    update,
    updateToolImage,
    pickTool,
    adjustStock,
    setLastId,
    SOCKET_tool,
  };
});
