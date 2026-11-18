import {
  changedSchedulePlacements,
  DEFAULT_SCHEDULE_SETTINGS,
  placeScheduleEntry,
  type SchedulePlacement,
} from '@repo/utilities/schedule';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

const REFRESH_DEBOUNCE_MS = 250;

function toPlacement(entry: SchedulePlacement): ScheduleEntryPlacement {
  return { _id: entry._id, machineId: entry.machineId, start: entry.start, days: entry.days };
}

export const useScheduleStore = defineStore('schedule', () => {
  const entries = ref<ScheduleEntry[]>([]);
  const loading = ref(false);
  /** Earliest day loaded; everything that runs on or after it is kept. */
  const from = ref<string | null>(null);
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let listening = false;

  const settings = ref<ScheduleSettings>(structuredClone(DEFAULT_SCHEDULE_SETTINGS));
  const settingsLoaded = ref(false);

  async function fetchSettings() {
    try {
      const { data } = await api.get<ScheduleSettings>('/schedule/settings');
      settings.value = data;
      settingsLoaded.value = true;
    } catch (error) {
      toastError('Failed to load schedule settings');
      throw error;
    }
  }

  async function saveSettings(next: ScheduleSettings) {
    try {
      const { data } = await api.put<ScheduleSettings>('/schedule/settings', { settings: next });
      settings.value = data;
      toastSuccess('Schedule settings saved');
      return data;
    } catch (error) {
      toastError('Failed to save schedule settings');
      throw error;
    }
  }

  // Settings change rarely and are needed wherever estimates are made, so always keep them live.
  socket.on('scheduleSettings', (data: ScheduleSettings) => {
    settings.value = data;
  });

  async function fetch(nextFrom: string) {
    from.value = nextFrom;
    loading.value = true;
    try {
      const { data } = await api.get<ScheduleEntry[]>('/schedule', { params: { from: nextFrom } });
      // A later fetch for a different range may have started while this one was in flight.
      if (from.value === nextFrom) entries.value = data;
    } catch (error) {
      toastError('Failed to load the schedule');
      throw error;
    } finally {
      loading.value = false;
    }
  }

  function refresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (from.value) void fetch(from.value).catch(() => undefined);
    }, REFRESH_DEBOUNCE_MS);
  }

  /** Moves or resizes an entry, pushing later entries on its machine out of the way. */
  async function place(placement: ScheduleEntryPlacement) {
    const before = entries.value;
    const after = placeScheduleEntry(before, placement);
    const changed = changedSchedulePlacements(before, after);
    if (!changed.length) return;

    entries.value = after;
    try {
      await api.put('/schedule', { entries: changed.map(toPlacement) });
    } catch (error) {
      toastError('Failed to update the schedule');
      refresh();
      throw error;
    }
  }

  /** Books a job onto a machine, pushing later entries on that machine out of the way. */
  async function add(job: ScheduleEntryJob, placement: Omit<ScheduleEntryPlacement, '_id'>) {
    const draftId = `draft:${job._id}:${Date.now()}`;
    const before = entries.value;
    const draft: ScheduleEntry = { ...placement, _id: draftId, job };
    const after = placeScheduleEntry([...before, draft], draft);
    const pushed = changedSchedulePlacements(before, after).filter(
      (entry) => entry._id !== draftId,
    );

    entries.value = after;
    try {
      const { data } = await api.post<ScheduleEntry>('/schedule', {
        entry: { job: job._id, ...placement },
        pushed: pushed.map(toPlacement),
      });
      entries.value = entries.value.map((entry) => (entry._id === draftId ? data : entry));
      return data;
    } catch (error) {
      entries.value = entries.value.filter((entry) => entry._id !== draftId);
      toastError('Failed to schedule the job');
      refresh();
      throw error;
    }
  }

  async function remove(entryId: string) {
    const before = entries.value;
    entries.value = before.filter((entry) => entry._id !== entryId);
    try {
      await api.delete(`/schedule/${entryId}`);
    } catch (error) {
      entries.value = before;
      toastError('Failed to remove the job from the schedule');
      throw error;
    }
  }

  /** Keeps the schedule live while a view needs it. */
  function listen() {
    if (listening) return;
    listening = true;
    socket.on('schedule', refresh);
    socket.on('job', refresh);
    socket.on('jobDeleted', refresh);
  }

  function stopListening() {
    if (!listening) return;
    listening = false;
    socket.off('schedule', refresh);
    socket.off('job', refresh);
    socket.off('jobDeleted', refresh);
  }

  return {
    entries,
    loading,
    from,
    settings,
    settingsLoaded,
    fetch,
    refresh,
    place,
    add,
    remove,
    listen,
    stopListening,
    fetchSettings,
    saveSettings,
  };
});
