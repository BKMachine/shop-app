<template>
  <div class="schedule-settings">
    <p class="text-body-2 text-medium-emphasis">
      New bookings start at an estimated length of qty × the part's cycle time for the machine's
      department, spread over the working day below at each department's utilization — the share of
      the day a machine is actually cutting.
    </p>

    <section class="schedule-settings__section">
      <div class="text-subtitle-2">Working day</div>
      <div class="schedule-settings__row">
        <v-select
          v-model="draft.workdayStartHour"
          class="schedule-settings__hour"
          density="compact"
          hide-details
          :items="startHourOptions"
          label="Starts"
          variant="outlined"
        />
        <v-select
          v-model="draft.workdayEndHour"
          class="schedule-settings__hour"
          density="compact"
          :error-messages="hoursError"
          :hide-details="!hoursError"
          :items="endHourOptions"
          label="Ends"
          variant="outlined"
        />
        <span class="text-body-2">{{ hoursPerDay }} h per day</span>
      </div>
      <v-chip-group v-model="draft.workdays" column filter multiple selected-class="text-primary">
        <v-chip v-for="day in WEEKDAYS" :key="day.value" :value="day.value" variant="outlined">
          {{ day.label }}
        </v-chip>
      </v-chip-group>
    </section>

    <section class="schedule-settings__section">
      <div class="text-subtitle-2">Utilization</div>
      <div class="schedule-settings__grid">
        <template v-for="row in utilizationRows" :key="row.id">
          <div class="schedule-settings__name">{{ row.name }}</div>
          <v-text-field
            class="schedule-settings__percent"
            density="compact"
            hide-details
            max="100"
            min="1"
            :model-value="row.value"
            suffix="%"
            type="number"
            variant="outlined"
            @update:model-value="setUtilization(row.id, $event)"
          />
          <div class="text-body-2 text-medium-emphasis">
            {{ formatHours((hoursPerDay * row.value) / 100) }} h cutting per day
          </div>
        </template>
      </div>
      <div class="text-body-2 text-medium-emphasis">
        Departments added later start at the default.
      </div>
    </section>

    <div class="schedule-settings__actions">
      <v-btn :disabled="!dirty || saving" variant="text" @click="reset">Undo Changes</v-btn>
      <v-btn color="primary" :disabled="!dirty || !valid" :loading="saving" @click="save">
        Save
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { scheduleUtilization } from '@repo/utilities/schedule';
import { computed, onMounted, ref, watch } from 'vue';
import { fetchDepartments } from '@/lib/machineDepartments';
import { useScheduleStore } from '@/stores/schedule_store';

const DEFAULT_ROW_ID = 'default';

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const scheduleStore = useScheduleStore();
const departments = ref<Department[]>([]);
const draft = ref<ScheduleSettings>(cloneSettings(scheduleStore.settings));
const saving = ref(false);

/** A plain copy to edit; the store's settings are a reactive proxy structuredClone can't copy. */
function cloneSettings(settings: ScheduleSettings): ScheduleSettings {
  return {
    ...settings,
    workdays: [...settings.workdays],
    departmentUtilization: { ...settings.departmentUtilization },
  };
}

function formatHour(hour: number) {
  const suffix = hour < 12 || hour === 24 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

const startHourOptions = Array.from({ length: 24 }, (_, hour) => ({
  title: formatHour(hour),
  value: hour,
}));
const endHourOptions = Array.from({ length: 24 }, (_, index) => ({
  title: index === 23 ? 'Midnight' : formatHour(index + 1),
  value: index + 1,
}));

const hoursPerDay = computed(() =>
  Math.max(draft.value.workdayEndHour - draft.value.workdayStartHour, 0),
);
const hoursError = computed(() =>
  hoursPerDay.value > 0 ? '' : 'The working day must end after it starts.',
);

const utilizationRows = computed(() => [
  { id: DEFAULT_ROW_ID, name: 'Default', value: draft.value.defaultUtilization },
  ...departments.value.map((department) => ({
    id: department._id,
    name: department.name,
    value: scheduleUtilization(draft.value, department._id),
  })),
]);

const valid = computed(
  () =>
    !hoursError.value &&
    utilizationRows.value.every((row) => Number.isFinite(row.value) && row.value >= 1),
);

/** Every department gets an explicit value, so changing the default later doesn't move them. */
const payload = computed<ScheduleSettings>(() => ({
  workdayStartHour: draft.value.workdayStartHour,
  workdayEndHour: draft.value.workdayEndHour,
  workdays: [...draft.value.workdays].sort((left, right) => left - right),
  defaultUtilization: draft.value.defaultUtilization,
  departmentUtilization: Object.fromEntries(
    departments.value.map((department) => [
      department._id,
      scheduleUtilization(draft.value, department._id),
    ]),
  ),
}));

const dirty = computed(
  () => JSON.stringify(payload.value) !== JSON.stringify(normalize(scheduleStore.settings)),
);

function normalize(settings: ScheduleSettings): ScheduleSettings {
  return {
    ...settings,
    workdays: [...settings.workdays].sort((left, right) => left - right),
    departmentUtilization: Object.fromEntries(
      departments.value.map((department) => [
        department._id,
        scheduleUtilization(settings, department._id),
      ]),
    ),
  };
}

function setUtilization(id: string, value: string | number) {
  const percent = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  if (id === DEFAULT_ROW_ID) {
    draft.value.defaultUtilization = percent;
    return;
  }
  draft.value.departmentUtilization = { ...draft.value.departmentUtilization, [id]: percent };
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function reset() {
  draft.value = cloneSettings(scheduleStore.settings);
}

async function save() {
  if (!valid.value) return;
  saving.value = true;
  try {
    await scheduleStore.saveSettings(payload.value);
    reset();
  } catch {
    // The store reports the failure; keep the draft so nothing typed is lost.
  } finally {
    saving.value = false;
  }
}

// Pick up saves made from another device while nothing here has been changed.
watch(
  () => scheduleStore.settings,
  () => {
    if (!dirty.value) reset();
  },
);

onMounted(async () => {
  const [loadedDepartments] = await Promise.all([
    fetchDepartments().catch(() => [] as Department[]),
    scheduleStore.fetchSettings().catch(() => undefined),
  ]);
  departments.value = loadedDepartments;
  reset();
});
</script>

<style scoped>
.schedule-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.schedule-settings__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.schedule-settings__hour {
  flex: 0 0 160px;
}

.schedule-settings__grid {
  display: grid;
  grid-template-columns: minmax(120px, max-content) 120px auto;
  align-items: center;
  gap: 8px 16px;
}

.schedule-settings__name {
  font-weight: 500;
}

.schedule-settings__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
