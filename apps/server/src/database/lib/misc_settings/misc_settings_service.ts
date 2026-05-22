import MiscSettingsModel from './misc_settings_model.js';

const SETTINGS_ID = 'misc-settings' as const;

function normalizeOffsetValue(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeSettings(data?: Partial<MiscSettings> | null): MiscSettings {
  return {
    _id: SETTINGS_ID,
    itemLabelOffset: {
      x: normalizeOffsetValue(data?.itemLabelOffset?.x),
      y: normalizeOffsetValue(data?.itemLabelOffset?.y),
    },
  };
}

async function get(): Promise<MiscSettings> {
  const doc = await MiscSettingsModel.findById(SETTINGS_ID).lean<MiscSettings>();
  return normalizeSettings(doc);
}

async function update(data: Partial<MiscSettings>): Promise<MiscSettings> {
  const normalized = normalizeSettings(data);

  await MiscSettingsModel.findByIdAndUpdate(SETTINGS_ID, normalized, {
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return normalized;
}

export default {
  get,
  update,
};
