import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/plugins/axios';

function createEmptyGroups(): ToolCategoryGroups {
  return {
    milling: [],
    turning: [],
    swiss: [],
    other: [],
  };
}

function createEmptyCounts(): ToolCategoryTypeCounts {
  return {
    milling: {},
    turning: {},
    swiss: {},
    other: {},
  };
}

function normalizeToolType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function normalizeGroup(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const nextValue = normalizeToolType(value);
    if (!nextValue) continue;

    const key = nextValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(nextValue);
  }

  return normalized;
}

function normalizeSettings(data?: Partial<ToolCategorySettings> | null): ToolCategorySettings {
  return {
    _id: 'tool-categories',
    groups: {
      milling: normalizeGroup(data?.groups?.milling),
      turning: normalizeGroup(data?.groups?.turning),
      swiss: normalizeGroup(data?.groups?.swiss),
      other: normalizeGroup(data?.groups?.other),
    },
  };
}

function normalizeCounts(data?: Partial<ToolCategoryTypeCounts> | null): ToolCategoryTypeCounts {
  return {
    milling: normalizeCountMap(data?.milling),
    turning: normalizeCountMap(data?.turning),
    swiss: normalizeCountMap(data?.swiss),
    other: normalizeCountMap(data?.other),
  };
}

function normalizeCountMap(values: unknown): Record<string, number> {
  if (!values || typeof values !== 'object') return {};

  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => Number.isFinite(value))
      .map(([key, value]) => [key.toLowerCase(), Number(value)]),
  );
}

function normalizeResponse(
  data?: Partial<ToolCategorySettingsResponse> | null,
): ToolCategorySettingsResponse {
  return {
    ...normalizeSettings(data),
    counts: normalizeCounts(data?.counts),
  };
}

export const useToolCategoryStore = defineStore('tool-categories', () => {
  const settings = ref<ToolCategorySettings>({
    _id: 'tool-categories',
    groups: createEmptyGroups(),
  });
  const counts = ref<ToolCategoryTypeCounts>(createEmptyCounts());
  const loaded = ref(false);
  const loading = ref(false);
  const saving = ref(false);

  async function fetch(force = false) {
    if (loading.value) return;
    if (loaded.value && !force) return;

    loading.value = true;

    try {
      const { data } = await api.get<ToolCategorySettingsResponse>('/tool-categories');
      const normalized = normalizeResponse(data);
      settings.value = normalizeSettings(normalized);
      counts.value = normalized.counts;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function save(groups: ToolCategoryGroups) {
    saving.value = true;

    try {
      const { data } = await api.put<ToolCategorySettingsResponse>('/tool-categories', {
        data: {
          _id: 'tool-categories',
          groups,
        },
      });

      const normalized = normalizeResponse(data);
      settings.value = normalizeSettings(normalized);
      counts.value = normalized.counts;
      loaded.value = true;
      return settings.value;
    } finally {
      saving.value = false;
    }
  }

  function getTypes(category: ToolFilterCategory): readonly string[] {
    if (category === 'all') {
      return Array.from(
        new Set([
          ...settings.value.groups.milling,
          ...settings.value.groups.turning,
          ...settings.value.groups.swiss,
          ...settings.value.groups.other,
        ]),
      ).sort((left, right) => left.localeCompare(right));
    }
    return settings.value.groups[category];
  }

  function getTypeCount(category: ToolCategory, toolType: string | null | undefined): number {
    const normalized = normalizeToolType(toolType)?.toLowerCase();
    if (!normalized) return 0;
    return counts.value[category][normalized] ?? 0;
  }

  return {
    settings,
    counts,
    loaded,
    loading,
    saving,
    fetch,
    save,
    getTypes,
    getTypeCount,
  };
});
