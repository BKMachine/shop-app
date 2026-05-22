import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/plugins/axios';

function normalizeOffsetValue(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeSettings(data?: Partial<MiscSettings> | null): MiscSettings {
  return {
    _id: 'misc-settings',
    itemLabelOffset: {
      x: normalizeOffsetValue(data?.itemLabelOffset?.x),
      y: normalizeOffsetValue(data?.itemLabelOffset?.y),
    },
  };
}

export const useMiscSettingsStore = defineStore('misc-settings', () => {
  const settings = ref<MiscSettings>(normalizeSettings());
  const loaded = ref(false);
  const loading = ref(false);
  const saving = ref(false);

  async function fetch(force = false) {
    if (loading.value) return;
    if (loaded.value && !force) return;

    loading.value = true;

    try {
      const { data } = await api.get<MiscSettings>('/misc-settings');
      settings.value = normalizeSettings(data);
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function save(itemLabelOffset: LabelOffset) {
    saving.value = true;

    try {
      const { data } = await api.put<MiscSettings>('/misc-settings', {
        data: {
          _id: 'misc-settings',
          itemLabelOffset,
        },
      });

      settings.value = normalizeSettings(data);
      loaded.value = true;
      return settings.value;
    } finally {
      saving.value = false;
    }
  }

  return {
    settings,
    loaded,
    loading,
    saving,
    fetch,
    save,
  };
});
