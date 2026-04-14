import Tool from '../tool/tool_model.js';
import ToolCategorySettingsModel from './tool_category_settings_model.js';

const SETTINGS_ID = 'tool-categories' as const;

const DEFAULT_TOOL_CATEGORY_GROUPS: ToolCategoryGroups = {
  milling: ['Endmill', 'Ball Endmill', 'Drill', 'Reamer'],
  turning: ['Insert', 'Stick Holder', 'Bore Bar'],
  swiss: ['Insert', 'Stick Holder', 'Bore Bar'],
  other: [],
};

function normalizeToolType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function normalizeGroup(values: unknown, fallback: string[]): string[] {
  const source = Array.isArray(values) ? values : fallback;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of source) {
    const nextValue = normalizeToolType(value);
    if (!nextValue) continue;

    const key = nextValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(nextValue);
  }

  return normalized;
}

function cloneDefaults(): ToolCategoryGroups {
  return {
    milling: [...DEFAULT_TOOL_CATEGORY_GROUPS.milling],
    turning: [...DEFAULT_TOOL_CATEGORY_GROUPS.turning],
    swiss: [...DEFAULT_TOOL_CATEGORY_GROUPS.swiss],
    other: [...DEFAULT_TOOL_CATEGORY_GROUPS.other],
  };
}

function normalizeSettings(data?: Partial<ToolCategorySettings> | null): ToolCategorySettings {
  const defaults = cloneDefaults();
  const groups = data?.groups;

  return {
    _id: SETTINGS_ID,
    groups: {
      milling: normalizeGroup(groups?.milling, defaults.milling),
      turning: normalizeGroup(groups?.turning, defaults.turning),
      swiss: normalizeGroup(groups?.swiss, defaults.swiss),
      other: normalizeGroup(groups?.other, defaults.other),
    },
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

async function getCounts(): Promise<ToolCategoryTypeCounts> {
  const rows = await Tool.aggregate<{
    _id: { category: ToolCategory; toolType: string };
    total: number;
  }>([
    {
      $match: {
        category: { $in: ['milling', 'turning', 'swiss', 'other'] },
        toolType: { $type: 'string' },
      },
    },
    {
      $project: {
        category: 1,
        toolType: {
          $trim: {
            input: '$toolType',
          },
        },
      },
    },
    {
      $match: {
        toolType: { $ne: '' },
      },
    },
    {
      $group: {
        _id: {
          category: '$category',
          toolType: { $toLower: '$toolType' },
        },
        total: { $sum: 1 },
      },
    },
  ]);

  const counts = createEmptyCounts();

  for (const row of rows) {
    counts[row._id.category][row._id.toolType] = row.total;
  }

  return counts;
}

async function get(): Promise<ToolCategorySettingsResponse> {
  const doc = await ToolCategorySettingsModel.findById(SETTINGS_ID).lean<ToolCategorySettings>();
  const [settings, counts] = await Promise.all([
    Promise.resolve(normalizeSettings(doc)),
    getCounts(),
  ]);
  return { ...settings, counts };
}

async function update(data: Partial<ToolCategorySettings>): Promise<ToolCategorySettingsResponse> {
  const normalized = normalizeSettings(data);

  await ToolCategorySettingsModel.findByIdAndUpdate(SETTINGS_ID, normalized, {
    upsert: true,
    setDefaultsOnInsert: true,
  });

  const counts = await getCounts();
  return { ...normalized, counts };
}

export default {
  get,
  update,
};
